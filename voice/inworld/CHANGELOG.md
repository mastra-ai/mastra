# @mastra/voice-inworld

## 0.3.3

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

## 0.3.3-alpha.0

### Patch Changes

- Security remediation for the 2026-06-17 "easy-day-js" supply-chain incident. Patch bump to publish clean versions and move the `latest` dist-tag forward, superseding the compromised versions that declared the malicious `easy-day-js` dependency. ([#18056](https://github.com/mastra-ai/mastra/pull/18056))

## 0.3.0

### Minor Changes

- `@mastra/voice-inworld` now ships `InworldRealtimeVoice` for full-duplex realtime voice — mic in, speakers out, server-side LLM routing, semantic VAD turn-taking, tool calling, barge-in, and live transcripts of both sides — alongside the existing streaming TTS and batch STT. No separate package needed; import both from the same entry point. ([#16865](https://github.com/mastra-ai/mastra/pull/16865))

  ```typescript
  // Batch TTS / STT (unchanged)
  import { InworldVoice } from '@mastra/voice-inworld';

  // New: realtime full-duplex voice, from the same package
  import { InworldRealtimeVoice } from '@mastra/voice-inworld';

  const voice = new InworldRealtimeVoice({
    apiKey: process.env.INWORLD_API_KEY,
    // Defaults: model 'inworld/models/gemma-4-26b-a4b-it', speaker 'Sarah',
    // STT 'inworld/inworld-stt-1', semantic-VAD turn detection.
  });

  await voice.connect();
  voice.on('speaker', stream => playAudio(stream)); // PCM16 @ 24kHz
  voice.on('writing', ({ text, role }) => console.log(role, text));
  voice.on('interrupted', ({ response_id }) => stopAudio(response_id));
  await voice.send(getMicrophoneStream());
  ```

  **Typed `providerData` for Inworld realtime extensions**

  `InworldRealtimeVoice` now accepts a typed `providerData` object for Inworld-specific extensions — STT tuning, TTS segmentation and steering, automatic memory, back-channel, and responsiveness — sent under `session.providerData`. The provider also surfaces inbound extension data: a `voiceProfile` on user `writing` events, a `memory` event for the rolling summary/facts state, and `backchannel` / `backchannel.done` / `backchannel.skipped` events for back-channel audio.

  ```typescript
  const voice = new InworldRealtimeVoice({
    providerData: {
      stt: { voice_profile: true, language_hints: ['en-US'] },
      tts: { delivery_mode: 'CREATIVE', segmenter_strategy: 'balanced' },
      memory: { enabled: true, turn_interval: 4 },
      backchannel: { enabled: true, max_per_turn: 1 },
    },
  });

  voice.on('memory', state => console.log(state.summary, state.facts));
  voice.on('backchannel', stream => playAudio(stream));
  voice.on('writing', ({ role, voiceProfile }) => console.log(role, voiceProfile?.emotion));
  ```

  **Realtime fixes and additions**
  - Fixed the per-call `speak(text, { speaker })` voice override. It is now sent as the flat `response.voice` field, so the per-call speaker is no longer silently ignored by the server.
  - Added manual turn-taking methods `commitInput()`, `clearInput()`, and `clearOutput()` for push-to-talk and manual turn control (use `clearOutput()` only to hard-stop all playback — it also stops in-flight back-channels).
  - Added smart-turn and playback-state events: `turn-suggestion`, `turn-suggestion-revoked`, `input-committed`, `input-cleared`, `input-timeout`, and `output-audio-started` / `output-audio-stopped` / `output-audio-cleared`.
  - Added richer typed session config: input noise reduction, telephony (8 kHz) and float32 audio formats, a server-VAD `idle_timeout_ms`, plus `tracing`, `include`, and `prompt`.

  ```typescript
  // Push-to-talk with no auto-VAD
  const voice = new InworldRealtimeVoice({
    session: { audio: { input: { turn_detection: null } } },
  });

  await voice.send(getMicrophoneStream());
  voice.commitInput(); // end the user turn manually

  voice.on('output-audio-stopped', () => console.log('playback finished'));
  ```

### Patch Changes

- Moved shared voice primitives and route metadata into the new `@internal/voice` package so voice providers no longer depend on `@mastra/core` and server voice routes share the same route definitions. ([#16725](https://github.com/mastra-ai/mastra/pull/16725))

  `@mastra/core/voice` continues to re-export the voice APIs for backwards compatibility.

## 0.3.0-alpha.1

### Minor Changes

- `@mastra/voice-inworld` now ships `InworldRealtimeVoice` for full-duplex realtime voice — mic in, speakers out, server-side LLM routing, semantic VAD turn-taking, tool calling, barge-in, and live transcripts of both sides — alongside the existing streaming TTS and batch STT. No separate package needed; import both from the same entry point. ([#16865](https://github.com/mastra-ai/mastra/pull/16865))

  ```typescript
  // Batch TTS / STT (unchanged)
  import { InworldVoice } from '@mastra/voice-inworld';

  // New: realtime full-duplex voice, from the same package
  import { InworldRealtimeVoice } from '@mastra/voice-inworld';

  const voice = new InworldRealtimeVoice({
    apiKey: process.env.INWORLD_API_KEY,
    // Defaults: model 'inworld/models/gemma-4-26b-a4b-it', speaker 'Sarah',
    // STT 'inworld/inworld-stt-1', semantic-VAD turn detection.
  });

  await voice.connect();
  voice.on('speaker', stream => playAudio(stream)); // PCM16 @ 24kHz
  voice.on('writing', ({ text, role }) => console.log(role, text));
  voice.on('interrupted', ({ response_id }) => stopAudio(response_id));
  await voice.send(getMicrophoneStream());
  ```

  **Typed `providerData` for Inworld realtime extensions**

  `InworldRealtimeVoice` now accepts a typed `providerData` object for Inworld-specific extensions — STT tuning, TTS segmentation and steering, automatic memory, back-channel, and responsiveness — sent under `session.providerData`. The provider also surfaces inbound extension data: a `voiceProfile` on user `writing` events, a `memory` event for the rolling summary/facts state, and `backchannel` / `backchannel.done` / `backchannel.skipped` events for back-channel audio.

  ```typescript
  const voice = new InworldRealtimeVoice({
    providerData: {
      stt: { voice_profile: true, language_hints: ['en-US'] },
      tts: { delivery_mode: 'CREATIVE', segmenter_strategy: 'balanced' },
      memory: { enabled: true, turn_interval: 4 },
      backchannel: { enabled: true, max_per_turn: 1 },
    },
  });

  voice.on('memory', state => console.log(state.summary, state.facts));
  voice.on('backchannel', stream => playAudio(stream));
  voice.on('writing', ({ role, voiceProfile }) => console.log(role, voiceProfile?.emotion));
  ```

  **Realtime fixes and additions**
  - Fixed the per-call `speak(text, { speaker })` voice override. It is now sent as the flat `response.voice` field, so the per-call speaker is no longer silently ignored by the server.
  - Added manual turn-taking methods `commitInput()`, `clearInput()`, and `clearOutput()` for push-to-talk and manual turn control (use `clearOutput()` only to hard-stop all playback — it also stops in-flight back-channels).
  - Added smart-turn and playback-state events: `turn-suggestion`, `turn-suggestion-revoked`, `input-committed`, `input-cleared`, `input-timeout`, and `output-audio-started` / `output-audio-stopped` / `output-audio-cleared`.
  - Added richer typed session config: input noise reduction, telephony (8 kHz) and float32 audio formats, a server-VAD `idle_timeout_ms`, plus `tracing`, `include`, and `prompt`.

  ```typescript
  // Push-to-talk with no auto-VAD
  const voice = new InworldRealtimeVoice({
    session: { audio: { input: { turn_detection: null } } },
  });

  await voice.send(getMicrophoneStream());
  voice.commitInput(); // end the user turn manually

  voice.on('output-audio-stopped', () => console.log('playback finished'));
  ```

## 0.2.1-alpha.0

### Patch Changes

- Moved shared voice primitives and route metadata into the new `@internal/voice` package so voice providers no longer depend on `@mastra/core` and server voice routes share the same route definitions. ([#16725](https://github.com/mastra-ai/mastra/pull/16725))

  `@mastra/core/voice` continues to re-export the voice APIs for backwards compatibility.

## 0.2.0

### Minor Changes

- Added Inworld AI voice integration with streaming TTS and batch STT. Supports inworld-tts-2 (default), inworld-tts-1.5-max, and inworld-tts-1.5-mini models for text-to-speech, with groq/whisper-large-v3 for speech-to-text. Includes 22+ built-in voices, configurable audio encoding, per-call `deliveryMode` and `language` overrides (deliveryMode honored only by inworld-tts-2), and progressive NDJSON audio streaming with backpressure handling. ([#14945](https://github.com/mastra-ai/mastra/pull/14945))

### Patch Changes

- Updated dependencies [[`9f17410`](https://github.com/mastra-ai/mastra/commit/9f1741080def23d42ee50b39887a385ae316a3c6), [`7ad5585`](https://github.com/mastra-ai/mastra/commit/7ad55856406f1de398dc713f6a9eaa78b2784bb6), [`ac47842`](https://github.com/mastra-ai/mastra/commit/ac478427aa7a5f5fdaed633a911218689b438c60), [`cc189cc`](https://github.com/mastra-ai/mastra/commit/cc189cc0128eb7af233476b5e421ec6888bffde7), [`d1fdbd0`](https://github.com/mastra-ai/mastra/commit/d1fdbd012add5623cb7e6b7f882b605ab358bbb4), [`210ea7a`](https://github.com/mastra-ai/mastra/commit/210ea7af559791b73a44fc9c12179908aaa3183f), [`7c275a8`](https://github.com/mastra-ai/mastra/commit/7c275a810595e1a6c41ccc39720531ab65734700), [`bae019e`](https://github.com/mastra-ai/mastra/commit/bae019ecb6694da96909f7ec7b9eb3a0a33aa887), [`890b24c`](https://github.com/mastra-ai/mastra/commit/890b24cc7d32ed6aa4dfe253e54dc6bf4099f690), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`6742347`](https://github.com/mastra-ai/mastra/commit/6742347d71955d7639adc9ddf6ff8282de7ee3ba), [`b59316f`](https://github.com/mastra-ai/mastra/commit/b59316ffa0f7688165b0f9c81ccdf85da461e5b2), [`0f48ebf`](https://github.com/mastra-ai/mastra/commit/0f48ebfc7ac7897b2092a189f45751924cf56d1c), [`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`83218c8`](https://github.com/mastra-ai/mastra/commit/83218c88b37773c9424fbe733b37be556e55e94d), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`c6eb39e`](https://github.com/mastra-ai/mastra/commit/c6eb39ea6dca381c6563cb240237fbe608e02f93), [`7b0ad1f`](https://github.com/mastra-ai/mastra/commit/7b0ad1f5c53dc118c6da12ae82ae2587037dc2b8), [`d91ebe2`](https://github.com/mastra-ai/mastra/commit/d91ebe28ee065d8f2ed6df741c3c07f58d359529), [`62666c3`](https://github.com/mastra-ai/mastra/commit/62666c367eaeac3941ead454b1d38810cc855721), [`33f5061`](https://github.com/mastra-ai/mastra/commit/33f5061cd1c0335020c3faae61ce96de822854fa), [`4af2160`](https://github.com/mastra-ai/mastra/commit/4af2160322f4718cac421930cce85641e9512389), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`265ec9f`](https://github.com/mastra-ai/mastra/commit/265ec9f887b5c81255c873a76ff7796f16e4f99b), [`ce01024`](https://github.com/mastra-ai/mastra/commit/ce010242eee9bdfc09e4c26725b9d37998679a8d), [`6ce80bf`](https://github.com/mastra-ai/mastra/commit/6ce80bf4872a891e0bddf8b80561a80584efb14b), [`f984b4d`](https://github.com/mastra-ai/mastra/commit/f984b4d6c60bf2ae2a9b156f0e8c35a66fe96c91), [`136c959`](https://github.com/mastra-ai/mastra/commit/136c9592fb0eeb0cd212f28629d8a29b7557a2fc), [`9268531`](https://github.com/mastra-ai/mastra/commit/9268531e7ec4be98beeba3b3ae8be0a7ea380662), [`13ead79`](https://github.com/mastra-ai/mastra/commit/13ead79149486b88144db7e11e6ff551caef5be1), [`dccd8f1`](https://github.com/mastra-ai/mastra/commit/dccd8f1f8b8f1ad203b77556207e5529567c616d), [`4df7cc7`](https://github.com/mastra-ai/mastra/commit/4df7cc79342fd065fe7fdeef93c094db14b12bcd), [`f180e49`](https://github.com/mastra-ai/mastra/commit/f180e4990e71b04c9a475b523584071712f0048f), [`9260e01`](https://github.com/mastra-ai/mastra/commit/9260e015276fb1b500f7878ee452b47476bf1583), [`2f6c54e`](https://github.com/mastra-ai/mastra/commit/2f6c54e17c041cac1def54baaa6b771647836414), [`aca3121`](https://github.com/mastra-ai/mastra/commit/aca31211233dac25459f140ea4fcfb3a5af64c18), [`e06a159`](https://github.com/mastra-ai/mastra/commit/e06a1598ca07a6c3778aefc2a2d288363c6294ff), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`b560d6f`](https://github.com/mastra-ai/mastra/commit/b560d6f88b9b904b15c10f75c949eb145bc27684), [`99869ec`](https://github.com/mastra-ai/mastra/commit/99869ecb1f2aa6dfcc44fa4e843e5ee0344efa64), [`900d086`](https://github.com/mastra-ai/mastra/commit/900d086bb737b9cf2fcf68f11b0389b801a2738c), [`4c0e286`](https://github.com/mastra-ai/mastra/commit/4c0e28637c9cfb4f416549b55e97ebfa13319dfc), [`55f1e2d`](https://github.com/mastra-ai/mastra/commit/55f1e2d65425b95a49ae788053b266f256e38c96), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`9cdf38e`](https://github.com/mastra-ai/mastra/commit/9cdf38e58506e1109c8b38f97cd7770978a4218e), [`087e413`](https://github.com/mastra-ai/mastra/commit/087e4133e5d6efa36619e9556c16750e4179c047), [`db34bc6`](https://github.com/mastra-ai/mastra/commit/db34bc6fb36cf125bda0c46be4d3fdc774b70cc4), [`990851e`](https://github.com/mastra-ai/mastra/commit/990851edcb0e30be5c2c18b6532f1a876cc2d335), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`8373ff4`](https://github.com/mastra-ai/mastra/commit/8373ff46745d77af79f183c4470f80fa2727a6b2), [`d48a705`](https://github.com/mastra-ai/mastra/commit/d48a705ff3dfbdc7a996e07ecd8293b5effd9a2a), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f), [`6068a6c`](https://github.com/mastra-ai/mastra/commit/6068a6c42950fad3ebfc92346417896ba60803d2), [`36b3bbf`](https://github.com/mastra-ai/mastra/commit/36b3bbf5a8d59f7e23d47e29340e76c681b4929c), [`d86f031`](https://github.com/mastra-ai/mastra/commit/d86f031eb6b0b2570145afafea664e59bf688962), [`b275631`](https://github.com/mastra-ai/mastra/commit/b275631dc10541a482b2e2d4a3e3cfa843bd5fa1), [`00106be`](https://github.com/mastra-ai/mastra/commit/00106bede59b81e5b0e9cd6aad8d3b5dbc336387), [`bd36d8e`](https://github.com/mastra-ai/mastra/commit/bd36d8eb6de8c9a0310352649dbd4b06703c2299), [`11c1528`](https://github.com/mastra-ai/mastra/commit/11c152848c5d0ef227184853b5040f5b41ee7b1e), [`4999667`](https://github.com/mastra-ai/mastra/commit/49996678b68356cad7f088430009690406c50fbd), [`e2a079c`](https://github.com/mastra-ai/mastra/commit/e2a079cc3755b1895f7bd5dc36e9be81b11c7c22), [`8ac9141`](https://github.com/mastra-ai/mastra/commit/8ac9141439caa8fdd674944c4d84f29b3c730296), [`25184ff`](https://github.com/mastra-ai/mastra/commit/25184ffaf1293ec95119426eb1a1f8d38831b96c), [`534a456`](https://github.com/mastra-ai/mastra/commit/534a456a25e4df1e5407e7e632f4cb3b1fa14f9d), [`105e454`](https://github.com/mastra-ai/mastra/commit/105e454c95af06a7c741c15969d8f9b0f02463a7), [`aebde9c`](https://github.com/mastra-ai/mastra/commit/aebde9cfacf56592c6b6350cae721740fe090b8a), [`36bae07`](https://github.com/mastra-ai/mastra/commit/36bae07c0e70b1b3006f2fd20830e8883dcbd066), [`5688881`](https://github.com/mastra-ai/mastra/commit/5688881669c7ed157f31ac77f6fc5f8d95ceea32)]:
  - @mastra/core@1.33.0

## 0.2.0-alpha.0

### Minor Changes

- Added Inworld AI voice integration with streaming TTS and batch STT. Supports inworld-tts-2 (default), inworld-tts-1.5-max, and inworld-tts-1.5-mini models for text-to-speech, with groq/whisper-large-v3 for speech-to-text. Includes 22+ built-in voices, configurable audio encoding, per-call `deliveryMode` and `language` overrides (deliveryMode honored only by inworld-tts-2), and progressive NDJSON audio streaming with backpressure handling. ([#14945](https://github.com/mastra-ai/mastra/pull/14945))

### Patch Changes

- Updated dependencies [[`37c0dc5`](https://github.com/mastra-ai/mastra/commit/37c0dc5697d343db98628bf867bf71ce6deec6d7), [`ef6b584`](https://github.com/mastra-ai/mastra/commit/ef6b5847ac33c0a7e80af3a86e8801e2933dd3ee), [`4dd900d`](https://github.com/mastra-ai/mastra/commit/4dd900d75dfe9be89f8c15188b368a8622aa1e18), [`4ff5bdf`](https://github.com/mastra-ai/mastra/commit/4ff5bdfe170cba6dfb5260c6af0f4ba668430772), [`bbcd93c`](https://github.com/mastra-ai/mastra/commit/bbcd93cf7d8aa1007d6d84bfd033b8015c912087), [`308bd07`](https://github.com/mastra-ai/mastra/commit/308bd074f35cef0c75d82fc1eb19382fe04ecf6f)]:
  - @mastra/core@1.33.0-alpha.11
