# @mastra/voice-hume

## 0.12.0

### Minor Changes

- Add Hume as a new voice provider with TTS support ([#TBD](https://github.com/mastra-ai/mastra/pull/13681))

  **Usage:**

  ```typescript
  import { HumeVoice } from '@mastra/voice-hume';

  const voice = new HumeVoice({
    speechModel: { apiKey: process.env.HUME_API_KEY },
    speaker: 'your-voice-name',
  });

  const audioStream = await voice.speak('Hello world');
  ```

  Hume provides expressive text-to-speech via their Octave model. Use `CompositeVoice` with Deepgram or another provider for speech-to-text capabilities.
