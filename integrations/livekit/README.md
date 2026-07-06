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

The package has two entry points, one per process:

- `@mastra/livekit` — server-side helpers (`liveKitConnectionRoute`, `dispatchVoiceSession`, `pipeAgentReplyToWriter`). Safe to import from Mastra server code; never loads the `@livekit/agents` runtime.
- `@mastra/livekit/worker` — the worker runtime (`createLiveKitWorker`, `runLiveKitWorker`). Import it only from the worker entry file.

## Quick start

A worker is a standalone Node process that connects to LiveKit and answers sessions. Define it with `createLiveKitWorker` and run it with `runLiveKitWorker`:

```typescript
// src/mastra/voice-worker.ts
import { fileURLToPath } from 'node:url';
import { createLiveKitWorker, runLiveKitWorker } from '@mastra/livekit/worker';
import { mastra } from './index';

export default createLiveKitWorker({
  mastra,
  agent: 'support', // a Mastra agent key/id (or a resolver, or use `workflow` instead)
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
  configuration: {
    greeting: { text: 'Thanks for calling. How can I help?' },
  },
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
import { createLiveKitWorker, chatContextToMessages } from '@mastra/livekit/worker';

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

| Option                                              | Type                                       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mastra`                                            | `Mastra`                                   | **Required.** The instance whose agents/workflows answer sessions.                                                                                                                                                                                                                                                                                                                                                           |
| **Reply generation** (pick one)                     |                                            |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `agent`                                             | `string \| Agent \| (args) => …`           | The agent that answers. Defaults to `metadata.agentId`.                                                                                                                                                                                                                                                                                                                                                                      |
| `workflow`                                          | `string \| Workflow \| (args) => string`   | Answer with a workflow instead. Requires `workflowInput`.                                                                                                                                                                                                                                                                                                                                                                    |
| `workflowInput`                                     | `(ctx & { metadata }) => inputData`        | Maps a turn into the workflow's `inputData`.                                                                                                                                                                                                                                                                                                                                                                                 |
| `replyStep`                                         | `string`                                   | Only stream text from this workflow step id.                                                                                                                                                                                                                                                                                                                                                                                 |
| `resultText`                                        | `(result) => string`                       | Fallback reply text when the workflow streams nothing.                                                                                                                                                                                                                                                                                                                                                                       |
| `generate`                                          | `VoiceReplyGenerator`                      | Lowest-level escape hatch.                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Speech stack**                                    |                                            |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `stt`                                               | plugin or `'provider/model'`               | Speech-to-text.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `tts`                                               | plugin or `'provider/model'`               | Text-to-speech.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `vad`                                               | `VAD \| 'silero' \| false`                 | Voice activity detection. Defaults to `'silero'`.                                                                                                                                                                                                                                                                                                                                                                            |
| `turnDetection`                                     | `'multilingual' \| 'english' \| …`         | End-of-turn detection.                                                                                                                                                                                                                                                                                                                                                                                                       |
| `turnHandling`                                      | `AgentSessionOptions['turnHandling']`      | Endpointing delays, interruption sensitivity, preemptive generation.                                                                                                                                                                                                                                                                                                                                                         |
| `sessionOptions` / `inputOptions` / `outputOptions` | partial LiveKit options                    | Merged over what the helper builds.                                                                                                                                                                                                                                                                                                                                                                                          |
| **Memory**                                          |                                            |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `memory`                                            | `false \| (args) => { thread, resource }`  | Memory mapping. Defaults to `{ thread: metadata.threadId ?? room, resource: metadata.resourceId ?? thread }` when the agent has memory.                                                                                                                                                                                                                                                                                      |
| `memoryInstance`                                    | `Memory \| (args) => Memory`               | The `Memory` used to bootstrap the thread + persist the greeting on the **workflow/custom** path (no agent to source it from). Mastra storage is injected if the `Memory` has none.                                                                                                                                                                                                                                          |
| `configuration`                                     | `{ greeting?, requireConsent?, endCall? }` | Grouped conversation & compliance config (see [Configuration](#configuration)). `greeting` (`text` — a string or a per-tenant resolver — plus `allowInterruptions`, `awaitPlayout`, `persist`, `repeatEvery`/`repeatText` for periodic AI re-disclosure), `requireConsent` (extensible consent set, e.g. `summaryStorage`, surfaced on `onCallEnd`), and `endCall` (agent-initiated hang-up; pair with `createEndCallTool`). |
| **Lifecycle hooks**                                 |                                            |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `toolFeedback`                                      | `(toolCall) => string \| void`             | Speak filler while a tool runs (agent + workflow).                                                                                                                                                                                                                                                                                                                                                                           |
| `onTurnComplete`                                    | `VoiceTurnCompleteHook`                    | After each turn streams, **fire-and-forget**, off the audio path.                                                                                                                                                                                                                                                                                                                                                            |
| `onCallEnd`                                         | `VoiceCallEndHook`                         | When the call ends, **awaited** within LiveKit's shutdown window.                                                                                                                                                                                                                                                                                                                                                            |
| `onSessionStart`                                    | `(args) => …`                              | After the session starts — attach listeners, trigger replies, etc.                                                                                                                                                                                                                                                                                                                                                           |
| **Other**                                           |                                            |                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `observability`                                     | `boolean`                                  | Voice-pipeline tracing. Defaults to `true`.                                                                                                                                                                                                                                                                                                                                                                                  |

## Configuration

`configuration` groups related conversation & compliance knobs in one place, so they don't each
become a top-level worker option — and it's where further compliance controls land as they ship.

```typescript
createLiveKitWorker({
  mastra,
  agent: 'support',
  configuration: {
    greeting: {
      // Spoken via TTS at call start (no model round-trip). Doubles as a required AI disclosure.
      text: 'You are speaking with an AI assistant. This call may be recorded. How can I help?',
      allowInterruptions: false, // caller can't barge over the disclosure (EU AI Act Art. 50)
      awaitPlayout: true, // hold post-greeting work until the disclosure finishes
      persist: true, // save it to the memory thread (default true)
      // Periodic re-disclosure on long calls: once this interval elapses, the NEXT turn's reply is
      // prefixed with a short "you're speaking with an AI" reminder (spoken at the turn boundary,
      // never mid-turn). Omit to disable.
      repeatEvery: 3 * 60_000, // ~every 3 minutes (California SB 243 and similar)
      repeatText: 'Quick reminder — you are speaking with an AI assistant.', // optional; has a default
    },
    // Consent requirements — a named, extensible set. Each item is independently required and
    // independently granted, so new items are added without one global "consented" flag.
    requireConsent: {
      summaryStorage: true, // or { required: true, purpose: 'storing a summary of this call' }
    },
    // Let the agent end the call itself. Pair with a `createEndCallTool` tool on the agent; the
    // worker waits for the agent's closing words to play out, then hangs up (running onCallEnd).
    endCall: {
      message: 'Thanks for calling. Goodbye!', // optional non-interruptible sign-off before hangup
    },
  },
});
```

**Greeting / AI disclosure.** `text` is spoken at call start; `allowInterruptions: false` makes a
required disclosure play through; `awaitPlayout: true` waits for it before anything else runs;
`repeatEvery` re-discloses periodically on long calls. Under the EU AI Act (Art. 50) a person must be
told they're interacting with an AI at the first interaction.

**Per-tenant greeting.** `greeting.text` also takes a resolver — a function called once per call
(post-connect) with the call context (`metadata`, `requestContext`, `roomName`, `ctx`). Return a
greeting keyed off the dispatch metadata so one multi-tenant agent opens differently per tenant (the
disclosure options still apply to whatever it returns; return `undefined` for no greeting):

```typescript
configuration: {
  greeting: {
    text: ({ metadata }) => {
      const tenant = TENANTS[metadata.requestContext?.tenantId as string];
      return `Thanks for calling ${tenant?.name ?? 'us'}. You're speaking with an AI assistant.`;
    },
    allowInterruptions: false, // the disclosure still can't be barged over
  },
},
```

**Consent.** `requireConsent` _declares_ which consents the call needs (starting with `summaryStorage`
— consent to store a call summary, e.g. observational memory). Capture the caller's decision at
runtime with **`createConsentTool`** (exported from `@mastra/livekit`) — add it to your agent, and it
reads the caller identity from the tool context and hands each decision to your store:

```typescript
import { createConsentTool } from '@mastra/livekit';

// in your agent's tools:
recordConsent: createConsentTool({
  items: ['summaryStorage'],
  onGrant: async ({ item, granted, resourceId }) => {
    if (resourceId) await db.saveConsent(resourceId, item, granted); // your system of record
  },
}),
```

Then _enforce_ it: the requirements are surfaced on the `onCallEnd` hook (`args.configuration`), so
you only run the consent-gated action (e.g. flush the call summary) when it isn't required or the
caller granted it. Further controls (recording notice, data retention, human handoff) are planned to
land here too.

**Agent-initiated hang-up.** `endCall` lets the agent end the call itself — say goodbye, then hang up.
Enable it under `configuration`, and add a matching tool to the agent with **`createEndCallTool`**
(both default to the tool name `'endCall'`). The tool only _signals_ intent — from inside
`agent.stream()` it can't reach the room — so the worker owns the hang-up: on each turn it watches for
the tool, waits for the agent's closing words to finish playing (so the goodbye is never cut off),
then disconnects, running `onCallEnd` on the way out exactly as a caller hang-up does. It works on the
agent and workflow reply paths.

```typescript
import { createEndCallTool } from '@mastra/livekit';

// in your agent's tools:
endCall: createEndCallTool({
  // optional bookkeeping — the tool reads the caller identity from its context
  onEndCall: ({ reason, resourceId }) => log.info('agent ended call', { reason, resourceId }),
}),
```

Instruct the agent to say its goodbye and then call `endCall` as its final action. `endCall.message`
adds a guaranteed non-interruptible sign-off spoken right before hanging up; `endCall.reason` sets the
shutdown reason in LiveKit logs; `endCall.maxWaitMs` caps how long to wait for the closing words
(default 30s). This is the AI-oversight companion to a future first-class human `handoff`.

**Backwards compatibility.** The previous top-level `greeting` (string) and `persistGreeting` options
still work — they're deprecated aliases for `configuration.greeting.text` and
`configuration.greeting.persist`. If both are set, `configuration.greeting` wins field-by-field, so
existing worker configs keep running unchanged while you migrate.

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

## Deployment

A voice deployment is **two long-running processes** plus a LiveKit media server:

| Component                | What runs it                                                        | Notes                                                                                                     |
| ------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **LiveKit media server** | LiveKit Cloud, or self-hosted `livekit-server` + Redis              | WebRTC transport. Both processes below need its `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`. |
| **Mastra HTTP server**   | `mastra build` → `node .mastra/output/index.mjs`                    | Your agents/workflows + `liveKitConnectionRoute` (mints tokens, dispatches the worker).                   |
| **LiveKit worker**       | your worker entry → `runLiveKitWorker` (LiveKit Agents CLI `start`) | Connects **outbound** to the media server and answers calls. Not an HTTP server.                          |

The worker is a **separate process**: `mastra build` bundles only your `Mastra` instance and `src/mastra/tools/**` — never the worker entry, because nothing imports it. `liveKitConnectionRoute`, by contrast, is an `apiRoute`, so it ships inside the server build automatically. The server and worker therefore build and run independently and can live on different hosts, as long as they share a LiveKit project and the same `agentName`.

> Note: `mastra worker build` is unrelated — it bundles Mastra's own pubsub/scheduler workflow workers (`mastra.startWorkers()`), not this LiveKit worker.

### Building the worker

The worker imports `@livekit/agents` (plus the optional plugins) and your `Mastra` instance, then runs the LiveKit Agents CLI. Two build-time essentials:

- **Run `start`, not `dev`, in production** — `dev` is hot-reload only.
- **Pre-download the model files** so they're baked into the image instead of fetched on cold start:

```bash
node --import tsx src/mastra/voice-worker.ts download-files   # Silero VAD + turn-detector ONNX
```

Running the worker with `tsx` against source avoids bundling LiveKit's native deps (onnxruntime, …). If you do, make `tsx` and the `@livekit/agents*` packages **real** dependencies (not devDependencies) in the deployed image.

### Docker

Build the server with `mastra build`, bake the model files, then run the two processes. **Recommended: one image, two services** — workers scale by call volume and the HTTP server scales by request volume, so keep them independent:

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx mastra build
RUN node --import tsx src/mastra/voice-worker.ts download-files

FROM node:22-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
EXPOSE 4111
# server service: CMD ["node", ".mastra/output/index.mjs"]
# worker service: CMD ["node", "--import", "tsx", "src/mastra/voice-worker.ts", "start"]
```

To run **both in one container** (single-tenant boxes, demos), supervise them with `bash` so the container exits — and is restarted by the orchestrator — if either dies:

```bash
#!/usr/bin/env bash
set -euo pipefail
node .mastra/output/index.mjs &
node --import tsx src/mastra/voice-worker.ts start &
wait -n
exit 1
```

This is simpler, but it couples two processes that have opposite scaling curves and no independent autoscaling — prefer the split for anything beyond a demo.

### Managed platforms (Mastra Cloud, Railway, Cloud Run, …)

Single-process HTTP hosts run the **Mastra server** as-is (`node .mastra/output/index.mjs`). They can't host the worker — it isn't an HTTP server, it isn't in the build output, and it's a long-lived outbound connection. Deploy the **hybrid**: the server on the managed platform (it still mints tokens and dispatches via the bundled connection route), and the worker on any plain process host (a dedicated Railway/Fly/Render service, a VM, a Kubernetes `Deployment`, ECS, …). Point both at the same LiveKit project, keep ≥1 always-on worker instance (no scale-to-zero, so it stays registered), and inject the shared `LIVEKIT_*` env into both.

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
