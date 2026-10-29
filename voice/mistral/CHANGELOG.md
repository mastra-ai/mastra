# @mastra/voice-mistral

## 0.1.3

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`@mistralai/mistralai@^2.7.0` ↗︎](https://www.npmjs.com/package/@mistralai/mistralai/v/2.7.0) (from `^2.4.1`, in `dependencies`)
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

## 0.1.3-alpha.0

### Patch Changes

- dependencies updates: ([#28417](https://github.com/mastra-ai/mastra/pull/28417))
  - Updated dependency [`@mistralai/mistralai@^2.7.0` ↗︎](https://www.npmjs.com/package/@mistralai/mistralai/v/2.7.0) (from `^2.4.1`, in `dependencies`)
  - Updated dependency [`@types/node@22.19.15` ↗︎](https://www.npmjs.com/package/@types/node/v/22.19.15) (from `22.20.5`, in `devDependencies`)

## 0.1.2

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

## 0.1.2-alpha.0

### Patch Changes

- Bump for npm ([#27221](https://github.com/mastra-ai/mastra/pull/27221))

## 0.1.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

## 0.1.1-alpha.1

### Patch Changes

- Update README to include accurate, up-to-date information ([#22858](https://github.com/mastra-ai/mastra/pull/22858))

## 0.1.1-alpha.0

### Patch Changes

- Remove `CHANGELOG.md` from distributed npm files resulting in reduced package size ([#22737](https://github.com/mastra-ai/mastra/pull/22737))

## 0.1.0

### Minor Changes

- Added Mistral voice provider (`@mastra/voice-mistral`) with text-to-speech and speech-to-text support using Mistral's Voxtral audio models. ([#19589](https://github.com/mastra-ai/mastra/pull/19589))

  **Text-to-speech** via `speak()` supports buffered and streaming output, multiple audio formats (mp3, wav, pcm, flac, opus), and one-off voice cloning via reference audio.

  **Speech-to-text** via `listen()` supports batch transcription with speaker diarization, context biasing, and timestamp granularity.

  **Voice discovery** via `getSpeakers()` fetches available preset voices from the Mistral Voices API.

  ```ts
  import { MistralVoice } from '@mastra/voice-mistral';

  const voice = new MistralVoice();

  // Text-to-speech
  const audioStream = await voice.speak('Hello from Mistral');

  // Speech-to-text
  const text = await voice.listen(audioStream, { language: 'en' });

  // Streaming TTS
  const stream = await voice.speak('Hello', { stream: true, responseFormat: 'pcm' });
  ```

## 0.1.0-alpha.0

### Minor Changes

- Added Mistral voice provider (`@mastra/voice-mistral`) with text-to-speech and speech-to-text support using Mistral's Voxtral audio models. ([#19589](https://github.com/mastra-ai/mastra/pull/19589))

  **Text-to-speech** via `speak()` supports buffered and streaming output, multiple audio formats (mp3, wav, pcm, flac, opus), and one-off voice cloning via reference audio.

  **Speech-to-text** via `listen()` supports batch transcription with speaker diarization, context biasing, and timestamp granularity.

  **Voice discovery** via `getSpeakers()` fetches available preset voices from the Mistral Voices API.

  ```ts
  import { MistralVoice } from '@mastra/voice-mistral';

  const voice = new MistralVoice();

  // Text-to-speech
  const audioStream = await voice.speak('Hello from Mistral');

  // Speech-to-text
  const text = await voice.listen(audioStream, { language: 'en' });

  // Streaming TTS
  const stream = await voice.speak('Hello', { stream: true, responseFormat: 'pcm' });
  ```
