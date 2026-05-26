{
  "targets": [
    {
      "target_name": "keyboard_sfx_audio",
      "sources": [ "native/src/audio_engine.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        [ "OS=='win'", {
          "libraries": [
            "-lole32",
            "-lavrt"
          ],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [ "/std:c++17" ]
            }
          }
        } ]
      ]
    }
  ]
}
