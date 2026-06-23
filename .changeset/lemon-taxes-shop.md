---
'@mastra/livekit': minor
---

Added `@mastra/livekit`, a new package that turns Mastra agents into realtime voice agents using LiveKit.

LiveKit's agents framework runs the audio loop — WebRTC transport, voice activity detection, streaming speech-to-text, semantic turn detection, and barge-in — while your Mastra agent generates every reply with its own model, tools, and memory. When a caller interrupts the agent, LiveKit cancels the in-flight stream and Mastra stops generating.

**What's included**

- `createLiveKitWorker()`: builds a LiveKit agent worker that answers voice sessions with your Mastra agents
- `runLiveKitWorker()`: starts the worker CLI (`dev`/`start`) for a worker entry file
- `createMastraVoiceAgent()`: the lower-level bridge for custom worker setups
- `liveKitConnectionRoute()`: an API route that mints LiveKit tokens and dispatches the voice agent into a room
- `dispatchVoiceSession()`: programmatic dispatch for server-initiated sessions such as outbound calls
- Built-in observability: when the Mastra instance has observability configured, each call opens a `voice call` trace that nests every turn's agent run and adds a child span for LiveKit's speech-to-text, text-to-speech, turn-detection, and LLM latency metrics, closing with a per-model token, character, and audio usage roll-up. On by default; pass `observability: false` to disable.

```ts
// src/mastra/voice-worker.ts
import { createLiveKitWorker } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});
```

See the [LiveKit voice guide](https://mastra.ai/docs/voice/livekit) for setup.
