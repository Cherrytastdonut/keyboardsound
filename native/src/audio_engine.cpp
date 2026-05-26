// ──────────────────────────────────────────────────────────────
// KeyboardSFX Native Audio Engine — Phase 3, first heartbeat
//
// Spec mapping:
//   §5  : ... → Native Audio Thread → ... → WASAPI Output
//   §6  : Audio Thread owns playback/mixing, separate from UI/Hook
//   §7  : Audio Thread must NEVER block (no malloc/mutex/IO in the
//         render loop). This first version proves we can open WASAPI
//         and push samples from a dedicated thread with low latency.
//   §24 : WASAPI Shared Mode first; Exclusive Mode is a later option.
//
// This is the SMALLEST possible heart: open the default output device,
// spin up a dedicated audio thread, and play a single short test tone
// on demand. Voice Pool (§10), Lock-free Queue (§9), Mixer (§14) all
// build on top of THIS proven foundation in later steps.
// ──────────────────────────────────────────────────────────────

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <avrt.h>
#include <napi.h>

#include <atomic>
#include <thread>
#include <cmath>
#include <vector>

#pragma comment(lib, "avrt.lib")

namespace {

const double PI = 3.14159265358979323846;

// COM smart-release helper (no exceptions in the realtime path).
template <typename T>
void SafeRelease(T** pp) {
  if (*pp) {
    (*pp)->Release();
    *pp = nullptr;
  }
}

// ──────────────────────────────────────────────────────────────
// AudioEngine: owns the WASAPI client and the dedicated render thread.
// The render thread is the ONLY thing that touches WASAPI buffers.
// ──────────────────────────────────────────────────────────────
class AudioEngine {
 public:
  AudioEngine() = default;
  ~AudioEngine() { Stop(); }

  // Initialize WASAPI shared-mode rendering and start the render thread.
  bool Start(std::string& err) {
    HRESULT hr;

    hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    // RPC_E_CHANGED_MODE means COM is already initialized on this thread
    // with a different model — that's fine, we just don't own it.
    com_owned_ = SUCCEEDED(hr);

    IMMDeviceEnumerator* enumerator = nullptr;
    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                          CLSCTX_ALL, __uuidof(IMMDeviceEnumerator),
                          reinterpret_cast<void**>(&enumerator));
    if (FAILED(hr)) { err = "CoCreateInstance(MMDeviceEnumerator) failed"; return false; }

    IMMDevice* device = nullptr;
    hr = enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device);
    SafeRelease(&enumerator);
    if (FAILED(hr)) { err = "GetDefaultAudioEndpoint failed"; return false; }

    hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr,
                          reinterpret_cast<void**>(&client_));
    SafeRelease(&device);
    if (FAILED(hr)) { err = "IAudioClient Activate failed"; return false; }

    // Use the device's native mix format (float32, device sample rate).
    hr = client_->GetMixFormat(&format_);
    if (FAILED(hr)) { err = "GetMixFormat failed"; return false; }
    sample_rate_ = format_->nSamplesPerSec;
    channels_ = format_->nChannels;

    // Event-driven, shared mode. Buffer of 0 lets WASAPI pick the
    // lowest safe shared-mode period (§ low latency goal).
    hr = client_->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
        0, 0, format_, nullptr);
    if (FAILED(hr)) { err = "IAudioClient Initialize failed"; return false; }

    event_ = CreateEvent(nullptr, FALSE, FALSE, nullptr);
    if (!event_) { err = "CreateEvent failed"; return false; }
    hr = client_->SetEventHandle(event_);
    if (FAILED(hr)) { err = "SetEventHandle failed"; return false; }

    hr = client_->GetBufferSize(&buffer_frames_);
    if (FAILED(hr)) { err = "GetBufferSize failed"; return false; }

    hr = client_->GetService(__uuidof(IAudioRenderClient),
                             reinterpret_cast<void**>(&render_));
    if (FAILED(hr)) { err = "GetService(IAudioRenderClient) failed"; return false; }

    running_.store(true, std::memory_order_release);
    thread_ = std::thread(&AudioEngine::RenderLoop, this);

    hr = client_->Start();
    if (FAILED(hr)) { err = "IAudioClient Start failed"; Stop(); return false; }

    return true;
  }

  void Stop() {
    if (running_.exchange(false)) {
      if (event_) SetEvent(event_);          // wake the loop so it can exit
      if (thread_.joinable()) thread_.join();
      if (client_) client_->Stop();
    }
    SafeRelease(&render_);
    SafeRelease(&client_);
    if (format_) { CoTaskMemFree(format_); format_ = nullptr; }
    if (event_) { CloseHandle(event_); event_ = nullptr; }
    if (com_owned_) { CoUninitialize(); com_owned_ = false; }
  }

  // Trigger a short test tone. Realtime-safe: only flips atomics, never
  // allocates or blocks (§7). The render thread reads these and fills
  // the WASAPI buffer with a sine burst.
  void TriggerTone(double freq_hz, double duration_ms) {
    double rate = sample_rate_ ? static_cast<double>(sample_rate_) : 48000.0;
    tone_freq_.store(freq_hz, std::memory_order_relaxed);
    tone_total_.store(static_cast<uint64_t>(rate * duration_ms / 1000.0),
                      std::memory_order_relaxed);
    tone_pos_.store(0, std::memory_order_release);  // release = "go"
  }

  uint32_t SampleRate() const { return sample_rate_; }
  uint32_t Channels() const { return channels_; }

 private:
  // The dedicated audio render thread (§6). This is the realtime path:
  // it must not allocate, lock, or do IO (§7).
  void RenderLoop() {
    // Ask MMCSS to schedule us as "Pro Audio" — lowers latency jitter.
    DWORD task_index = 0;
    HANDLE mmcss = AvSetMmThreadCharacteristics(L"Pro Audio", &task_index);

    while (running_.load(std::memory_order_acquire)) {
      // Wait until WASAPI says it needs more samples.
      WaitForSingleObject(event_, 2000);
      if (!running_.load(std::memory_order_acquire)) break;

      UINT32 padding = 0;
      if (FAILED(client_->GetCurrentPadding(&padding))) continue;
      UINT32 frames = buffer_frames_ - padding;
      if (frames == 0) continue;

      BYTE* data = nullptr;
      if (FAILED(render_->GetBuffer(frames, &data))) continue;

      FillSilenceOrTone(reinterpret_cast<float*>(data), frames);

      render_->ReleaseBuffer(frames, 0);
    }

    if (mmcss) AvRevertMmThreadCharacteristics(mmcss);
  }

  // Fill the buffer: either a sine burst (if a tone is active) or silence.
  void FillSilenceOrTone(float* out, UINT32 frames) {
    uint64_t total = tone_total_.load(std::memory_order_relaxed);
    uint64_t pos = tone_pos_.load(std::memory_order_acquire);
    double freq = tone_freq_.load(std::memory_order_relaxed);
    double rate = sample_rate_ ? static_cast<double>(sample_rate_) : 48000.0;
    uint32_t ch = channels_ ? channels_ : 2;

    for (UINT32 i = 0; i < frames; ++i) {
      float sample = 0.0f;
      if (pos < total) {
        double t = static_cast<double>(pos) / rate;
        // Simple attack-decay envelope so it sounds like a click, not a
        // hard-edged beep (a nod to §13 attack transient — refined later).
        double env = std::exp(-5.0 * t);
        sample = static_cast<float>(0.25 * env * std::sin(2.0 * PI * freq * t));
        ++pos;
      }
      for (uint32_t c = 0; c < ch; ++c) out[i * ch + c] = sample;
    }
    tone_pos_.store(pos, std::memory_order_release);
  }

  IAudioClient* client_ = nullptr;
  IAudioRenderClient* render_ = nullptr;
  WAVEFORMATEX* format_ = nullptr;
  HANDLE event_ = nullptr;
  UINT32 buffer_frames_ = 0;
  uint32_t sample_rate_ = 0;
  uint32_t channels_ = 0;
  bool com_owned_ = false;

  std::thread thread_;
  std::atomic<bool> running_{false};

  // Tone state (atomics so the JS thread can poke them safely).
  std::atomic<double> tone_freq_{440.0};
  std::atomic<uint64_t> tone_total_{0};
  std::atomic<uint64_t> tone_pos_{1};  // pos >= total → inactive at start
};

AudioEngine* g_engine = nullptr;

// ── N-API bridge: the contract of fate between JS and the C++ heart ──

Napi::Value Start(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_engine) return Napi::Boolean::New(env, true);

  g_engine = new AudioEngine();
  std::string err;
  if (!g_engine->Start(err)) {
    delete g_engine;
    g_engine = nullptr;
    Napi::Error::New(env, err).ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Boolean::New(env, true);
}

Napi::Value Stop(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (g_engine) {
    g_engine->Stop();
    delete g_engine;
    g_engine = nullptr;
  }
  return Napi::Boolean::New(env, true);
}

// playTone(freqHz?, durationMs?) — fire the test tone.
Napi::Value PlayTone(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (!g_engine) {
    Napi::Error::New(env, "engine not started").ThrowAsJavaScriptException();
    return env.Null();
  }
  double freq = info.Length() > 0 && info[0].IsNumber()
                    ? info[0].As<Napi::Number>().DoubleValue() : 440.0;
  double dur = info.Length() > 1 && info[1].IsNumber()
                   ? info[1].As<Napi::Number>().DoubleValue() : 80.0;
  g_engine->TriggerTone(freq, dur);
  return Napi::Boolean::New(env, true);
}

// info() — report sample rate / channels so JS can see the real device.
Napi::Value Info(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object obj = Napi::Object::New(env);
  if (g_engine) {
    obj.Set("sampleRate", Napi::Number::New(env, g_engine->SampleRate()));
    obj.Set("channels", Napi::Number::New(env, g_engine->Channels()));
    obj.Set("running", Napi::Boolean::New(env, true));
  } else {
    obj.Set("running", Napi::Boolean::New(env, false));
  }
  return obj;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("start", Napi::Function::New(env, Start));
  exports.Set("stop", Napi::Function::New(env, Stop));
  exports.Set("playTone", Napi::Function::New(env, PlayTone));
  exports.Set("info", Napi::Function::New(env, Info));
  return exports;
}

}  // namespace

NODE_API_MODULE(keyboard_sfx_audio, Init)
