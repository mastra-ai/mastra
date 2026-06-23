# @mastra/livekit

LiveKit voice integration for Mastra agents. LiveKit's agents framework runs the audio loop — WebRTC transport, voice activity detection, streaming speech-to-text, semantic turn detection, barge-in, and text-to-speech — and this package bridges reply generation to a Mastra agent's `stream()` call, so tools, memory, and model routing all run inside Mastra.

## Installation

```bash
npm install @mastra/livekit @livekit/agents @livekit/agents-plugin-silero @livekit/agents-plugin-livekit
```

## Usage

Create a worker entry file:

```typescript
// src/mastra/voice-worker.ts
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
```

Add a connection endpoint so frontends can join voice sessions:

```typescript
// src/mastra/index.ts
import { Mastra } from '@mastra/core/mastra';
import { liveKitConnectionRoute } from '@mastra/livekit';

export const mastra = new Mastra({
  server: {
    apiRoutes: [liveKitConnectionRoute({ agentName: 'mastra-voice' })],
  },
});
```

Run the worker alongside your Mastra server:

```bash
npx livekit-agents download-files
npx tsx src/mastra/voice-worker.ts dev
```

## Observability

When the Mastra instance has observability configured, the worker traces each call. It opens one `voice call` span per session, nests every turn's Mastra agent run under it, and adds a child span for each LiveKit pipeline metric — speech-to-text, text-to-speech, end-of-utterance, voice activity detection, and LLM time-to-first-token. The span closes with a per-model token, character, and audio usage roll-up. Tracing is on by default; pass `observability: false` to `createLiveKitWorker` to disable it.

## Documentation

- [Using LiveKit with Mastra](https://mastra.ai/docs/voice/livekit)
- [`@mastra/livekit` reference](https://mastra.ai/reference/voice/livekit)
- [LiveKit Agents docs](https://docs.livekit.io/agents/)
