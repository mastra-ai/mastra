---
'@mastra/voice-xai-realtime': minor
---

Added `@mastra/voice-xai-realtime`, a realtime voice provider for the xAI Grok Voice Agent API.

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
