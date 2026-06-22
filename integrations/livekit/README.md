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

## Transports (advanced)

A _transport_ is the seam between LiveKit's voice loop and your Mastra agent: given one turn, it returns a stream of agent chunks. By default `createLiveKitWorker` builds an **in-process** transport from your `mastra` instance and `agent`, running the agent's full loop (model, tools, memory) inside the worker process with no network hop. This is the right choice for almost everyone — you don't need to think about transports at all.

The seam exists so the agent can also run _outside_ the worker — e.g. in a long-running agent service the thin voice worker reaches over HTTP — without touching the voice pipeline, routes, or memory handling. Provide your own implementation of `VoiceAgentTransport`:

```typescript
import { createLiveKitWorker, type VoiceAgentTransport } from '@mastra/livekit';

const transport: VoiceAgentTransport = {
  async stream({ messages, memory, requestContext, abortSignal }) {
    // Return an async iterable of Mastra agent chunks (text-delta, tool-call, error, finish…).
    // e.g. POST to a Mastra server's agent-stream endpoint and decode the response.
  },
  // Optional: getInstructions, supportsMemory, ensureThread, persistGreeting — used for
  // the agent label and per-call memory thread. An in-process transport runs them against
  // the local agent; a remote transport forwards them or leaves them to the agent service.
};

export default createLiveKitWorker({ transport, stt: 'deepgram/nova-3', tts: 'cartesia/sonic-3' });
```

A batteries-included **remote transport** (HTTP client + the matching server route) is planned; until then, in-process is the only built-in transport and remote setups implement `VoiceAgentTransport` directly.

## Documentation

- [Using LiveKit with Mastra](https://mastra.ai/docs/voice/livekit)
- [`@mastra/livekit` reference](https://mastra.ai/reference/voice/livekit)
- [LiveKit Agents docs](https://docs.livekit.io/agents/)
