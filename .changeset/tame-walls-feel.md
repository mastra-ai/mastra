---
'@mastra/livekit': minor
---

Added a pluggable transport seam so a Mastra agent can run either inside the LiveKit voice worker (the default) or in a separate process, without changing the voice pipeline, connection route, or per-call memory handling.

`createLiveKitWorker` now accepts an optional `transport` (and `streamOptions`). When omitted it builds the default in-process transport from `mastra` + `agent`, so existing workers are unchanged. Supply your own `VoiceAgentTransport` to run the agent elsewhere — for example a long-running agent service the thin voice worker reaches over HTTP.

```ts
import { createLiveKitWorker, type VoiceAgentTransport } from '@mastra/livekit';

// Default — agent runs in the worker (unchanged):
createLiveKitWorker({ mastra, agent: 'support', stt: 'deepgram/nova-3', tts: 'cartesia/sonic-3' });

// Or bring your own transport (e.g. a remote agent service):
const transport: VoiceAgentTransport = {
  async stream({ messages, memory, requestContext, abortSignal }) {
    // return an async iterable of Mastra agent chunks (text-delta, tool-call, error, finish…)
  },
};
createLiveKitWorker({ transport, stt: 'deepgram/nova-3', tts: 'cartesia/sonic-3' });
```

The lower-level `MastraVoiceAgent` / `createMastraVoiceAgent` now take a `transport` instead of an `agent`; wrap an agent with the new `inProcessTransport(agent)` to migrate.
