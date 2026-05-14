# @mastra/voice-xai-realtime

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/voice-xai-realtime`, a realtime voice provider for the xAI Grok Voice Agent API. ([#16507](https://github.com/mastra-ai/mastra/pull/16507))

  Use `XAIRealtimeVoice` with Mastra's `Agent` voice primitive to connect, stream audio, and run xAI voice turns:

  ```ts
  import { Agent } from '@mastra/core/agent';
  import { XAIRealtimeVoice } from '@mastra/voice-xai-realtime';

  const voice = new XAIRealtimeVoice({
    apiKey: process.env.XAI_API_KEY,
    model: 'grok-voice-think-fast-1.0',
    speaker: 'eve',
    turnDetection: { type: 'server_vad' },
  });

  const agent = new Agent({
    id: 'voice-agent',
    name: 'Voice Agent',
    instructions: 'You are a helpful voice assistant.',
    model: 'xai/grok-4.3',
    voice,
  });

  await agent.voice.connect();
  agent.voice.on('speaker', audioStream => playAudio(audioStream));
  await agent.voice.speak('How can I help you today?');
  await agent.voice.send(microphoneStream);
  ```

### Patch Changes

- Updated dependencies [[`fceae1f`](https://github.com/mastra-ai/mastra/commit/fceae1f5f5db4722cb078a663c6eb4bd22944123), [`bf02acb`](https://github.com/mastra-ai/mastra/commit/bf02acbb8a6110f638ac844e89f1ebf04cb7fe74), [`0fd3fbe`](https://github.com/mastra-ai/mastra/commit/0fd3fbe40fb63657aedd72f6e7b38c8e8ee6940d), [`fed0475`](https://github.com/mastra-ai/mastra/commit/fed0475ccfea31e4fc251469ac05640d0742c1f0), [`522f44d`](https://github.com/mastra-ai/mastra/commit/522f44d947214bfc06cff50599bae1ef3494880d)]:
  - @mastra/core@1.34.0-alpha.1
