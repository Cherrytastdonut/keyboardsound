# Phase 3 — Native WASAPI Audio Engine (first heartbeat)

너의 예언서 §Phase 3을 그대로 구현한 단계다.
한 번에 모든 걸 짓지 않는다 — **WASAPI를 열어 단 하나의 톤을
저지연으로 출력하는 가장 작은 심장**부터 벼린다.
그 위에 Voice Pool(§10), Lock-free Queue(§9), Mixer(§14)를 얹는다.

## 구조 — 예언서와의 대응

```
native/
  src/audio_engine.cpp   ← WASAPI 심장 (§5 Native Audio Thread → WASAPI Output)
binding.gyp              ← node-gyp 빌드 설계도
electron/
  audio.ts               ← 메인 프로세스용 네이티브 addon JS 래퍼
  main.ts                ← 엔진 로드 + audio:playTone IPC 핸들러
  preload.ts             ← playTone 명령 통로 (§6 bridge)
src/components/
  SvgKeyboard.tsx        ← keydown → window.sfx.playTone (§4-1)
```

설계 율법:
- **§6** — Audio는 메인 프로세스에서만. 렌더러는 keydown 시 IPC 명령만 보낸다.
- **§7** — Audio Thread는 절대 block 금지. render loop에 malloc/mutex/IO 없음.
        톤 트리거는 atomic만 건드린다.
- **§24** — WASAPI Shared Mode + event-driven. Exclusive는 추후.
- **MMCSS** — render thread를 "Pro Audio"로 스케줄링해 지터 감소.

## ⚠️ 빌드 — 가장 중요한 진실

네이티브 addon은 **Node용**과 **Electron용**이 서로 다르게 컴파일된다.
Electron은 자기만의 Node ABI를 품고 있어서다. 둘을 헷갈리면
실행 시 "NODE_MODULE_VERSION mismatch" 에러가 난다.

우리 앱은 **Electron 안에서** 오디오 엔진을 로드하므로,
**반드시 Electron용으로 빌드해야 한다.**

### 권장: electron-rebuild 사용

```bash
npm install --save-dev @electron/rebuild
npx electron-rebuild
```

> `electron-rebuild`가 설치된 Electron 버전을 자동 감지해
> 정확한 ABI로 네이티브 모듈을 다시 빌드한다. 가장 안전한 길이다.

### 또는: 수동 빌드 (Electron 헤더 지정)

```bash
npm run build:native:electron
```

> binding.gyp을 Electron 33.4.11 헤더로 빌드한다.
> (Electron 버전을 바꾸면 이 스크립트의 --target도 맞춰 바꿔야 한다.)

### 빌드 확인

성공하면 이 파일이 생긴다:

```
build\Release\keyboard_sfx_audio.node
```

확인:

```cmd
dir build\Release\keyboard_sfx_audio.node
```

## 실행

```bash
npm run dev
```

> 창이 뜨면 키를 눌러라. 키캡이 빛나는 동시에 — 이번엔 **소리가 난다.**
> 키마다 다른 음높이(펜타토닉)로 울린다. 동시에 여러 키를 누르면
> 겹쳐 들린다(아직 voice pool 없이 단순 톤 재생이라 마지막 트리거 우선).

> 만약 소리가 안 나면: 네이티브 모듈이 빌드 안 됐거나 Electron ABI가
> 안 맞는 것이다. dev 콘솔(또는 터미널)에 `[audio] native engine
> failed to load:` 메시지가 뜨는지 확인하라. 그 메시지를 가져오면
> 정확히 진단할 수 있다.

## 다음 전장 (Phase 4 핵심)

- §10 Voice Pool — 32 voice 고정 풀, generation 기반 stale 방지
- §3 Hybrid Polyphony — 동시 재생, key ownership
- §13 Attack Preservation — attack 최우선
- §12 Smart Voice Stealing — 새 타건 보호
- §8/§9 Audio Command Queue (SPSC ring buffer) — Hook→Audio lock-free
- PCM preload (§21) — 실제 WAV 사운드로 톤 교체
