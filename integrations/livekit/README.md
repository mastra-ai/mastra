# @mastra/livekit

Realtime voice for [Mastra](https://mastra.ai) agents and workflows, powered by [LiveKit Agents](https://docs.livekit.io/agents/).

LiveKit's agents framework owns the **audio loop** — WebRTC transport, voice activity detection (VAD), streaming speech-to-text (STT), semantic turn detection, barge-in, and text-to-speech (TTS). This package bridges **reply generation** to Mastra, so each detected user turn is answered by a Mastra **agent** (`agent.stream()`) or **workflow** — with your tools, memory, processors, and model routing all running inside Mastra.

```
caller speaks ─▶ VAD ─▶ STT ─▶ turn detection ─▶ [ Mastra agent / workflow ] ─▶ TTS ─▶ caller hears
                  (LiveKit owns the audio loop)        (this package bridges replies)
```

## What's in the box

- **Two reply paths** — answer turns with a Mastra **agent** (the default, richest path) or a Mastra **workflow** (run-to-completion per turn, e.g. deterministic intent routing). A low-level `generate` escape hatch accepts any custom reply generator.
- **Full speech stack, pluggable** — STT/TTS as LiveKit inference model strings (`'deepgram/nova-3'`, `'cartesia/sonic-3'`) or your own plugin instances; Silero VAD and LiveKit multilingual/English turn detection; barge-in cancels in-flight generation automatically.
- **Memory, scoped to the call** — `thread` = call, `resource` = caller, so a returning caller is recognized across calls. Up-front thread creation and greeting persistence keep the saved thread a faithful transcript. Works on the agent path and the workflow path (via `memoryInstance`).
- **Lifecycle hooks** — `toolFeedback` (speak filler while a tool runs), `onTurnComplete` (post-turn, fire-and-forget, off the audio path), and `onCallEnd` (end-of-call, awaited within LiveKit's shutdown window — the place to flush observational memory).
- **Observability** — one `voice call` trace per session with LiveKit pipeline metrics and every Mastra run nested under it.
- **Connection + dispatch helpers** — `liveKitConnectionRoute` mints tokens and dispatches the worker so a frontend can join.

## Installation

```bash
npm install @mastra/livekit @livekit/agents @livekit/agents-plugin-silero @livekit/agents-plugin-livekit
```

Peer dependencies (`@mastra/core` and `@livekit/agents` are required; the two plugins are optional but enable the defaults):

| Package                          | Needed for                                   |
| -------------------------------- | -------------------------------------------- |
| `@mastra/core`                   | the Mastra agent/workflow you bridge to      |
| `@livekit/agents`                | the audio loop runtime                       |
| `@livekit/agents-plugin-silero`  | the default `vad: 'silero'`                  |
| `@livekit/agents-plugin-livekit` | `turnDetection: 'multilingual' \| 'english'` |

## Quick start

A worker is a standalone Node process that connects to LiveKit and answers sessions. Define it with `createLiveKitWorker` and run it with `runLiveKitWorker`:

```typescript
// src/mastra/voice-worker.ts
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support', // a Mastra agent key/id (or a resolver, or use `workflow` instead)
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  greeting: 'Thanks for calling. How can I help?',
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runLiveKitWorker({ entry: import.meta.url, agentName: 'mastra-voice' });
}
```

Add a connection endpoint to your Mastra server so a frontend can join, then dispatch the worker:

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
npx livekit-agents download-files   # one-time: turn-detection + VAD model files
npx tsx src/mastra/voice-worker.ts dev
```

The model strings (`deepgram/nova-3`, `cartesia/sonic-3`) route through **LiveKit Cloud inference**, so with a LiveKit Cloud project you don't need separate Deepgram/Cartesia accounts — only your `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` (plus whatever key your Mastra model needs). To bring your own providers, pass plugin instances to `stt` / `tts` instead of strings.

## Reply paths

### Agent (default)

Pass `agent` (a key/id, an `Agent` instance, or a resolver). The agent runs its full loop each turn — model, tools, memory, processors — and streams its text deltas to TTS. Barge-in cancels the in-flight `agent.stream()`.

### Workflow

Pass `workflow` + `workflowInput` instead of `agent` (mutually exclusive). LiveKit owns the turn boundary, so the workflow runs **once to completion per turn** — no suspend/resume. Use it for deterministic per-turn structure (e.g. classify intent, then reply).

```typescript
import { createLiveKitWorker, chatContextToMessages } from '@mastra/livekit';

export default createLiveKitWorker({
  mastra,
  workflow: 'phoneConversation',
  workflowInput: ({ messages, memory }) => ({ turn: messages, memory: memory || undefined }),
  replyStep: 'generateResponse', // only stream text from this step (optional)
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});
```

In the reply-producing step, use **`pipeAgentReplyToWriter`** to forward the agent's reply into the step `writer`. It streams text deltas (so TTS starts early) **and** tool-call chunks (so `toolFeedback` fires and `onTurnComplete` sees the tool list) — unlike piping only `.textStream`, which silently drops tool calls:

```typescript
import { pipeAgentReplyToWriter } from '@mastra/livekit';

const generateResponse = createStep({
  id: 'generateResponse',
  execute: async ({ inputData, mastra, writer, abortSignal }) => {
    const stream = await mastra.getAgent('support').stream(inputData.turn, {
      memory: inputData.memory, // engages working memory, recall, etc.
      abortSignal, // lets barge-in stop generation promptly
    });
    const reply = await pipeAgentReplyToWriter(stream, writer);
    return { reply };
  },
});
```

A step that writes no text stays silent unless you pass `resultText` to derive the reply from the final run result.

### Custom (`generate`)

For full control, pass a `generate` function — any `VoiceReplyGenerator` that turns a turn into a `ReadableStream<string>` (a remote bridge, a bespoke pipeline, …).

## `createLiveKitWorker` options

| Option                                              | Type                                      | Notes                                                                                                                                                                               |
| --------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mastra`                                            | `Mastra`                                  | **Required.** The instance whose agents/workflows answer sessions.                                                                                                                  |
| **Reply generation** (pick one)                     |                                           |                                                                                                                                                                                     |
| `agent`                                             | `string \| Agent \| (args) => …`          | The agent that answers. Defaults to `metadata.agentId`.                                                                                                                             |
| `workflow`                                          | `string \| Workflow \| (args) => string`  | Answer with a workflow instead. Requires `workflowInput`.                                                                                                                           |
| `workflowInput`                                     | `(ctx & { metadata }) => inputData`       | Maps a turn into the workflow's `inputData`.                                                                                                                                        |
| `replyStep`                                         | `string`                                  | Only stream text from this workflow step id.                                                                                                                                        |
| `resultText`                                        | `(result) => string`                      | Fallback reply text when the workflow streams nothing.                                                                                                                              |
| `generate`                                          | `VoiceReplyGenerator`                     | Lowest-level escape hatch.                                                                                                                                                          |
| **Speech stack**                                    |                                           |                                                                                                                                                                                     |
| `stt`                                               | plugin or `'provider/model'`              | Speech-to-text.                                                                                                                                                                     |
| `tts`                                               | plugin or `'provider/model'`              | Text-to-speech.                                                                                                                                                                     |
| `vad`                                               | `VAD \| 'silero' \| false`                | Voice activity detection. Defaults to `'silero'`.                                                                                                                                   |
| `turnDetection`                                     | `'multilingual' \| 'english' \| …`        | End-of-turn detection.                                                                                                                                                              |
| `turnHandling`                                      | `AgentSessionOptions['turnHandling']`     | Endpointing delays, interruption sensitivity, preemptive generation.                                                                                                                |
| `sessionOptions` / `inputOptions` / `outputOptions` | partial LiveKit options                   | Merged over what the helper builds.                                                                                                                                                 |
| **Memory**                                          |                                           |                                                                                                                                                                                     |
| `memory`                                            | `false \| (args) => { thread, resource }` | Memory mapping. Defaults to `{ thread: metadata.threadId ?? room, resource: metadata.resourceId ?? thread }` when the agent has memory.                                             |
| `memoryInstance`                                    | `Memory \| (args) => Memory`              | The `Memory` used to bootstrap the thread + persist the greeting on the **workflow/custom** path (no agent to source it from). Mastra storage is injected if the `Memory` has none. |
| `greeting`                                          | `string`                                  | Spoken when the session starts.                                                                                                                                                     |
| `persistGreeting`                                   | `boolean`                                 | Save the greeting to the thread. Defaults to `true`.                                                                                                                                |
| **Lifecycle hooks**                                 |                                           |                                                                                                                                                                                     |
| `toolFeedback`                                      | `(toolCall) => string \| void`            | Speak filler while a tool runs (agent + workflow).                                                                                                                                  |
| `onTurnComplete`                                    | `VoiceTurnCompleteHook`                   | After each turn streams, **fire-and-forget**, off the audio path.                                                                                                                   |
| `onCallEnd`                                         | `VoiceCallEndHook`                        | When the call ends, **awaited** within LiveKit's shutdown window.                                                                                                                   |
| `onSessionStart`                                    | `(args) => …`                             | After the session starts — attach listeners, trigger replies, etc.                                                                                                                  |
| **Other**                                           |                                           |                                                                                                                                                                                     |
| `observability`                                     | `boolean`                                 | Voice-pipeline tracing. Defaults to `true`.                                                                                                                                         |

## Lifecycle hooks

Three hooks let you do work around a turn without adding to the caller's latency:

```typescript
createLiveKitWorker({
  mastra,
  agent: 'support',

  // 1. In-turn: speak a short phrase while a tool runs, so the caller isn't left in silence.
  toolFeedback: ({ toolName }) => (toolName === 'lookupOrder' ? 'Let me pull that up.' : undefined),

  // 2. Post-turn: fire-and-forget AFTER the reply has streamed — the worker never awaits it, so it
  //    can't delay the caller or the next turn. Carries the produced reply + the memory mapping.
  onTurnComplete: async ({ result, memory }) => {
    if (memory) await crm.logContact(memory.resource, result.text); // result.text/toolCalls/interrupted
  },

  // 3. End-of-call: runs when the caller hangs up, AWAITED within LiveKit's shutdown grace window
  //    (so it finishes before the process exits). The place for end-of-call memory maintenance.
  onCallEnd: async ({ memory, memoryInstance }) => {
    // e.g. flush observational memory once for the whole call instead of paying for it per turn.
  },
});
```

`onTurnComplete` and `toolFeedback` work on the **workflow** path too (the reply step must surface tool calls via `pipeAgentReplyToWriter`).

## Joining a call: `liveKitConnectionRoute`

Mounts an API route on your Mastra server that mints a LiveKit token and dispatches the worker by `agentName`. Frontends `POST` to it to get connection details.

| Option                               | Default                                                  | Notes                                               |
| ------------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| `path`                               | `/voice/livekit/connection-details`                      | Must not start with `/api`.                         |
| `serverUrl` / `apiKey` / `apiSecret` | `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | LiveKit credentials.                                |
| `agentName`                          | —                                                        | Must match the worker's `agentName`.                |
| `ttl`                                | `'15m'`                                                  | Token lifetime.                                     |
| `requiresAuth`                       | `true`                                                   | Mastra custom routes require auth unless opted out. |
| `roomName` / `participantIdentity`   | generated                                                | String or `(args) => string`.                       |
| `metadata`                           | passes `agentId`/`threadId`/`resourceId`                 | Session metadata delivered to the worker.           |

For programmatic dispatch (no HTTP), use `dispatchVoiceSession`.

## Running the worker: `runLiveKitWorker`

Starts the LiveKit agent worker CLI (`dev` / `start` / `connect`) for your entry file.

| Option          | Default          | Notes                                               |
| --------------- | ---------------- | --------------------------------------------------- |
| `entry`         | —                | The worker module; pass `import.meta.url`.          |
| `agentName`     | `'mastra-voice'` | Dispatch name; must match `liveKitConnectionRoute`. |
| `serverOptions` | —                | Extra LiveKit `ServerOptions`.                      |

## Observability

When the Mastra instance has observability configured, the worker opens one `voice call` span per session, nests every turn's Mastra run under it, and adds child spans for LiveKit pipeline metrics — STT, TTS, end-of-utterance, VAD, and LLM time-to-first-token — closing with a per-model token/character/audio usage roll-up. On by default; pass `observability: false` to disable.

## Runnable example

A complete, runnable reference lives in the Mastra monorepo at **[`examples/voice-agent`](https://github.com/mastra-ai/mastra/tree/main/examples/voice-agent)** — a trades-contractor front-desk voice agent that exercises nearly every feature here:

- **Both entrypoints** — an agent worker (`pnpm worker`) and a workflow worker (`pnpm worker:workflow`, deterministic intent routing → memory-backed reply).
- **Three memory layers** — working memory, semantic recall, and observational memory, all scoped to the caller.
- **Tools + deterministic reconciliation**, a tenant-context input processor, the `toolFeedback` / `onTurnComplete` / `onCallEnd` hooks, and full observability.

To run it:

```bash
git clone https://github.com/mastra-ai/mastra
cd mastra && pnpm install && pnpm build:packages   # build the workspace packages

cd examples/voice-agent
cp .env.example .env            # add LiveKit Cloud creds + your model key (e.g. OPENAI_API_KEY)
pnpm install
pnpm worker:download-files      # one-time model download

# in two terminals:
pnpm dev                        # Mastra server + Studio at http://localhost:4111
pnpm worker                     # the voice worker (or `pnpm worker:workflow`)
```

See the example's own [`README.md`](https://github.com/mastra-ai/mastra/tree/main/examples/voice-agent) for the scenario walkthrough and the memory/latency design notes.

## Documentation

- [Using LiveKit with Mastra](https://mastra.ai/docs/voice/livekit)
- [`@mastra/livekit` reference](https://mastra.ai/reference/voice/livekit)
- [LiveKit Agents docs](https://docs.livekit.io/agents/)
