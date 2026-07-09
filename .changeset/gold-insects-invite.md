---
'@mastra/livekit': minor
---

Added `MastraLLM`, a standard LiveKit LLM plugin, on the new `@mastra/livekit/plugin` entry point. Build your own `voice.AgentSession` and put a Mastra agent in the `llm` slot — the agent loop, tools, and memory run on a remote Mastra server reached over HTTP, so the worker process needs no Mastra app, database, or model provider keys.

Before, the worker wrapper always owned the LiveKit session:

```ts
import { createLiveKitWorker } from '@mastra/livekit/worker';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
});
```

Now you can own the session and keep Mastra as the LLM component:

```ts
import { voice } from '@livekit/agents';
import { MastraLLM } from '@mastra/livekit/plugin';

const session = new voice.AgentSession({
  llm: new MastraLLM({
    remote: { baseUrl: process.env.MASTRA_URL!, agentId: 'support' },
    memory: { thread: callId, resource: userId },
  }),
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  // Required with `memory`: LiveKit enables preemptive generation by default.
  turnHandling: { preemptiveGeneration: { enabled: false } },
});
```

`createLiveKitWorker` stays the batteries-included path; the plugin is the composable one. Tools keep running server-side on the Mastra agent, and interrupting the agent aborts the server-side generation.

**New transport and helpers**

- Added `createRemoteAgentReplyGenerator()`: streams replies from a remote Mastra server over HTTP with per-turn abort, LiveKit-typed errors, and a connect + first-token timeout. It also plugs into `createLiveKitWorker`'s `generate` option to run the existing worker against a remote server.
- Promoted `speakGreeting()`, `waitForAgentDoneSpeaking()`, and `runEndCall()` to public exports of `@mastra/livekit/worker`, so a worker that owns its session can rebuild the greeting and agent-initiated hang-up patterns in a few lines.

**Improvements to the existing worker**

- Interrupted turns now self-heal: when a caller interrupts a reply, nothing is persisted at that moment, and the part the caller actually heard is backfilled into the memory thread on the next turn — so saved transcripts match the call.
- Added an `onToolCall` hook that fires as each tool call starts mid-reply, the building block for tool-driven side effects such as analytics or hang-up.
- `onTurnComplete` now receives the turn's token usage as `result.usage`.
