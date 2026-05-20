---
'@mastra/voice-inworld-realtime': minor
---

Added `@mastra/voice-inworld-realtime`, a full-duplex realtime voice provider for [Inworld](https://platform.inworld.ai). Drop it into a Mastra `Agent` and you get mic in, speakers out, tool calling, barge-in, and live transcripts of both sides of the conversation — Inworld picks the LLM via its server-side router, so you don't need a second model client.

**Usage**

```typescript
import { Agent } from '@mastra/core/agent';
import { InworldRealtimeVoice } from '@mastra/voice-inworld-realtime';

const agent = new Agent({
  id: 'voice-demo',
  name: 'Voice Demo',
  instructions: 'You are a concise voice assistant.',
  model: 'n/a', // Inworld runs the LLM server-side
  voice: new InworldRealtimeVoice({
    apiKey: process.env.INWORLD_API_KEY,
    model: 'anthropic/claude-sonnet-4-6',
    speaker: 'Dennis',
  }),
});

await agent.voice.connect();
agent.voice.on('speaker', stream => playAudio(stream));        // PCM16 @ 24kHz
agent.voice.on('writing', ({ text, role }) => console.log(role, text));
agent.voice.on('interrupted', ({ response_id }) => stopAudio(response_id));
await agent.voice.send(getMicrophoneStream());
```
