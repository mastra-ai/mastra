# Design: Workflow-driven entrypoint for `@mastra/livekit`

|             |                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------ |
| **Status**  | Draft / Proposed                                                                           |
| **Author**  | Michael (@mikhael28)                                                                       |
| **Date**    | 2026-06-25                                                                                 |
| **Package** | `integrations/livekit` (`@mastra/livekit`)                                                 |
| **Related** | PR #17896 (the package), Plancraft `plancraft/plancraft#21818` "Mastra workflow streaming" |

## Summary

Today `@mastra/livekit` generates every voice reply by calling `agent.stream()` (see
`MastraVoiceAgent.llmNode` in `src/bridge.ts`). This proposal adds a second supported
**reply generator**: a Mastra **workflow** that runs once per conversational turn and streams
its text back to LiveKit for TTS. Agents stay the default and lowest-friction path; workflows
become a first-class option for callers whose per-turn logic is genuinely multi-step
(intent classification → routing → tool orchestration → compose).

The change is small in surface area because it slots in behind a single seam — "given a turn,
produce a stream of text deltas" — and reuses the existing turn-message extraction,
observability, and memory-thread machinery unchanged.

## Motivation

Plancraft (an early adopter) is building a phone assistant where **the entrypoint is a
workflow**, not an agent — a `phoneConversation` workflow whose per-turn sub-workflow does
intent determination, lead qualification, contact capture, and callback handling before
composing a reply. Their feedback raised two questions:

1. Should the `@mastra/livekit` entrypoint be allowed to be a workflow, in addition to the
   agentic loop?
2. Can Mastra Memory be written by a workflow rather than only inside an agent thread?

Their own implementation (PR #21818, +916/−1512) is instructive. They:

- Switched per-turn generation from `agent.generate()` to `agent.stream()` then
  `stream.textStream.pipeTo(writer)` — surfacing tokens through the workflow's step `writer`.
- Bridged LiveKit ⇄ workflow over the **OpenAI Responses protocol**, modelling the _whole
  conversation_ as one long-lived workflow run that **suspends per turn** and resumes when the
  caller speaks.
- Hit a **race / state-reconciliation bug** because conversation history was accumulated in
  workflow `state` across suspend/resume.
- Fixed it by making LiveKit's transcript the single source of truth: each resume overwrites
  `state.history` with the full transcript instead of appending.
- **Removed Mastra Memory** entirely, with the telling comment: _"the sync of conversation
  history ↔ livekit transcript is complex … interruption handling: we need to know what of the
  generated response was actually spoken and adapt in the agent memory."_

We do not need to replicate their architecture 1:1 — they have signalled they're open to
re-architecting. We want to support the **spirit**: _a turn is a workflow that runs every
turn._ The key reframe is that this maps cleanly onto our existing model **without**
suspend/resume.

## Key insight: a turn is a workflow _run to completion_, not a suspended workflow

LiveKit already owns the audio loop — VAD, STT, semantic turn detection, barge-in, TTS — and
calls `llmNode` exactly **once per detected user turn**. That is a perfect match for **one
workflow run per turn**:

- **No `suspend()` / `resume()`.** LiveKit's turn detection _is_ the "wait for the next
  utterance." Each turn starts a fresh `createRun()` and runs to completion.
- **No accumulated workflow state, so no race.** Conversation history is passed _into_ the run
  each turn from LiveKit's chat context (transcript-as-truth) — which is precisely the model
  Plancraft re-architected toward. We get their fix for free, by construction, because there is
  no long-lived snapshot to read-modify-write.
- **No storage round-trip per turn.** A run-to-completion workflow with an in-process pubsub
  never persists a suspended snapshot, so we avoid the load/replay latency that suspend/resume
  pays on every turn.

Suspend/resume-per-turn (Plancraft's current shape) and the OpenAI-Responses transport boundary
are explicitly **out of scope** here (see [Alternatives](#alternatives-considered)). They solve
"the LiveKit worker and the Mastra backend are different deployed processes," which is a
separate, larger feature.

## Goals

- Let `createLiveKitWorker` / `createMastraVoiceAgent` use a **workflow** as the per-turn reply
  generator, streaming text to TTS with the same TTFT characteristics as the agent path.
- Keep **agents the default**; the workflow path is opt-in and additive. No breaking changes.
- Honor "everything is a workflow" via run-to-completion-per-turn (no suspend/resume).
- Reuse existing turn extraction (`messages.ts`), observability nesting, and memory-thread
  bootstrap unchanged.
- Provide a low-level escape hatch (a raw `generate` function) so advanced callers can plug any
  generator, including a custom workflow/HTTP bridge.

## Non-goals

- Modelling the whole call as a single suspendable workflow (suspend/resume per turn).
- An OpenAI-Responses-compatible HTTP/WS server in front of Mastra (tracked separately).
- Changing how LiveKit owns the audio loop.
- Solving working/observational memory for voice. This doc only touches conversation-turn
  persistence.

## Design

### The seam: a reply generator

`MastraVoiceAgent.llmNode` is reduced to: build the turn's messages, then ask a **reply
generator** for a `ReadableStream<string>` of text deltas. Two built-in generators implement
the seam; a third is a user-supplied function.

```ts
// New internal contract (src/bridge.ts)
export interface VoiceTurnContext {
  /** New-turn messages (memory on) or full session history (memory off). */
  messages: VoiceTurnMessage[];
  /** Raw LiveKit chat context, for generators that want full transcript / parts. */
  chatCtx: llm.ChatContext;
  memory: MastraVoiceAgentMemory | false;
  requestContext?: RequestContext;
  /** Voice-call span context, so each turn nests under the call. */
  tracingContext?: TracingContext;
  /** Aborted on barge-in / session close. */
  abortSignal: AbortSignal;
}

/** Returns a stream of text deltas (or null to stay silent this turn). */
export type VoiceReplyGenerator = (
  ctx: VoiceTurnContext,
) => ReadableStream<string> | null | Promise<ReadableStream<string> | null>;
```

`llmNode` becomes generator-agnostic:

```ts
override async llmNode(chatCtx, _toolCtx, _modelSettings) {
  const messages = this.memory === false
    ? chatContextToMessages(chatCtx)
    : extractNewTurnMessages(chatCtx);
  if (messages.length === 0) return null;

  const abortController = new AbortController();
  return this.replyGenerator({
    messages, chatCtx, memory: this.memory,
    requestContext: this.requestContext,
    tracingContext: this.streamOptions?.tracingContext,
    abortSignal: abortController.signal,
  });
  // cancel() on the returned stream aborts abortController (unchanged from today)
}
```

The existing agent logic moves into `createAgentReplyGenerator(...)` verbatim (the
`text-delta` / `tool-call` / `error` loop in today's `bridge.ts:135-167`). Behaviour for
current callers is identical.

### The workflow reply generator

```ts
// src/workflow-generator.ts (new)
import type { Workflow } from '@mastra/core/workflows';

export interface WorkflowReplyGeneratorOptions {
  workflow: Workflow;
  /** Map a turn into the workflow's inputData. Required — input schemas are caller-defined. */
  workflowInput: (ctx: VoiceTurnContext) => unknown | Promise<unknown>;
  /** Only stream text from this step (by id). Default: every step that writes text. */
  replyStep?: string;
  /** Fallback when the workflow doesn't stream via `writer`: pull text from the final result. */
  resultText?: (result: unknown) => string | undefined;
}

export function createWorkflowReplyGenerator(opts: WorkflowReplyGeneratorOptions): VoiceReplyGenerator {
  return async ctx => {
    const inputData = await opts.workflowInput(ctx);
    const run = await opts.workflow.createRun();
    const out = run.stream({ inputData, tracingContext: ctx.tracingContext });

    ctx.abortSignal.addEventListener(
      'abort',
      () => {
        void run.cancel();
      },
      { once: true },
    );

    return new ReadableStream<string>({
      start: async controller => {
        let streamedAny = false;
        try {
          for await (const chunk of out.fullStream) {
            if (ctx.abortSignal.aborted) break;
            if (chunk.type !== 'workflow-step-output') continue;
            if (opts.replyStep && chunk.payload.stepName !== opts.replyStep) continue;
            const text = unwrapStepText(chunk.payload.output); // string | {type:'text-delta',...}
            if (text) {
              streamedAny = true;
              controller.enqueue(text);
            }
          }
          if (!streamedAny && opts.resultText) {
            const finalText = opts.resultText(await out.result);
            if (finalText) controller.enqueue(finalText);
          }
          if (!ctx.abortSignal.aborted) controller.close();
        } catch (error) {
          if (ctx.abortSignal.aborted) return; // barge-in cancel, not a failure
          controller.error(error);
        }
      },
      cancel: () => {
        void run.cancel();
      },
    });
  };
}

function unwrapStepText(output: unknown): string | undefined {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && (output as any).type === 'text-delta') {
    return (output as any).payload?.text;
  }
  return undefined;
}
```

**Why `workflow-step-output`?** A workflow's own stream only emits _structured_ step lifecycle
events (`workflow-start`, `workflow-step-result`, `workflow-finish`, …) — there is no
`textStream`. Token text reaches the stream only when a step pipes it into its injected
`writer`, which surfaces as `workflow-step-output` with `payload.output` being either a raw
string (from `stream.textStream.pipeTo(writer)`) or a full `text-delta` chunk (from an
agent-as-step). The generator unwraps both. This is exactly the mechanism Plancraft's
`responsesWs.ts` consumes (`workflowTextOutputChunkSchema` → `response.output_text.delta`).

**The reply step must opt in.** A step that merely `return`s the agent's text yields a single
`workflow-step-result` at the end — no token streaming. To get low TTFT the reply-producing
step must pipe into `writer`:

```ts
const generateResponse = createStep({
  id: 'generateResponse',
  execute: async ({ inputData, mastra, writer, abortSignal }) => {
    const stream = await mastra.getAgent('voice').stream(inputData.messages, { abortSignal });
    await stream.textStream.pipeTo(writer); // tokens → workflow-step-output → TTS
    return { assistantMessage: await stream.text };
  },
});
```

This mirrors Plancraft's `phoneConversationTurn.ts` after their migration.

### Public API: `createLiveKitWorker`

`agent` and `workflow` are mutually exclusive. When `workflow` is set, `workflowInput` is
required (we can't infer an arbitrary input schema).

```ts
export interface CreateLiveKitWorkerOptions {
  mastra: Mastra;

  // Existing — unchanged:
  agent?: string | ((args: ResolveMastraAgentArgs) => string | MastraAgent | Promise<...>);

  // New — workflow-as-reply-generator:
  workflow?: string | Workflow | ((args: ResolveMastraAgentArgs) => string | Workflow | Promise<...>);
  workflowInput?: (ctx: VoiceTurnContext & { metadata: LiveKitSessionMetadata }) => unknown | Promise<unknown>;
  replyStep?: string;
  resultText?: (result: unknown) => string | undefined;

  // Lowest-level escape hatch — bring any generator (custom workflow, remote bridge, …):
  generate?: VoiceReplyGenerator;

  // …all other existing options (stt/tts/vad/turnDetection/memory/greeting/observability/…) unchanged
}
```

Resolution precedence in `worker.ts` `entry`: `generate` → `workflow` → `agent` → `metadata.agentId`.
Exactly one must resolve; otherwise throw the same shape of "no generator specified" error we
throw today for a missing agent.

#### Default `workflowInput`

If a caller omits `workflowInput` we throw with guidance, but the docs recommend this default
shape (transcript-as-truth):

```ts
workflowInput: ctx => ({
  messages: ctx.messages, // this turn's new messages
  history: chatContextToMessages(ctx.chatCtx), // full transcript so far
  userMessage: ctx.messages.findLast(m => m.role === 'user')?.content ?? '',
  metadata: ctx.metadata, // agentId/threadId/resourceId/requestContext
});
```

This hands the workflow the full conversation each turn from LiveKit's transcript — the same
contract Plancraft converged on — with no state carried in the workflow between turns.

### Worker example (mirrors the Plancraft shape, minus suspend/resume)

```ts
// src/mastra/voice-worker.ts
export default createLiveKitWorker({
  mastra,
  workflow: 'phoneConversation',
  workflowInput: ({ chatCtx, metadata }) => ({
    history: chatContextToMessages(chatCtx),
    metadata,
  }),
  replyStep: 'generateResponse',
  stt: 'deepgram/nova-3',
  tts: 'cartesia/sonic-3',
  turnDetection: 'multilingual',
});
```

The `phoneConversation` workflow here is a normal Mastra workflow that runs to completion each
turn: build prompt from `history` → classify intent / qualify / capture contact (parallel) →
`generateResponse` step that pipes `agent.stream().textStream` into `writer`. No
`awaitUserInput` suspend step — LiveKit owns the turn boundary.

### Barge-in / cancellation

LiveKit cancels the returned stream on interruption. The generator's `cancel()` calls
`run.cancel()`, and we stop reading `fullStream` immediately so TTS halts. **Caveat to
document:** `run.cancel()` aborts the workflow's controller, but in-flight model generation
inside a step only stops promptly if the step forwards its `abortSignal` into `agent.stream({
abortSignal })`. We will document this and pass `abortSignal` through in the example steps. (The
agent path already wires `abortSignal` directly, so it's unaffected.)

### Observability

Unchanged mechanism: the worker opens one `voice call` span (`startVoiceCallObservability`) and
threads `tracingContext` into the generator. The agent path passes it via
`streamOptions.tracingContext`; the workflow path passes it into `run.stream({ tracingContext
})`, so each turn's workflow run nests under the call span just like an agent run does today.
LiveKit pipeline metrics (STT/TTS/EOU/VAD/LLM) attach as child event spans exactly as now.

### Memory — related concern, recommended companion change

Strictly, the workflow entrypoint can ship without touching memory: with a workflow generator,
the bridge simply doesn't auto-persist turns (today's auto-save is a side effect of
`agent.stream({ memory })`). The workflow author may persist inside a step
(`mastra.getAgent(id).getMemory()` or `new Memory({ storage: mastra.getStorage() })` →
`createThread` / `saveMessages` — the same public API the agent uses internally).

But Plancraft's removal of Mastra Memory exposes a **latent fidelity bug that also affects our
agent path today**: we persist the _full generated_ assistant text, while barge-in cancels
mid-utterance — so the saved thread can diverge from what the caller actually heard.

**Recommendation (separate, sequenceable change):** make the bridge persist conversation turns
from LiveKit's **actually-spoken transcript** rather than the raw generated text, for _both_
generators. LiveKit already emits the spoken/interrupted transcript (the Studio hook
`use-voice-call.ts` consumes `lk.transcription` today); the worker can subscribe to the same
session transcript events and `saveMessages` the user utterance + the spoken assistant text via
the existing `voice-thread.ts` helpers. This is the change that would let Plancraft turn Mastra
Memory back **on**. Tracked as a follow-up so the workflow entrypoint isn't blocked on it.

## Implementation plan

Phase 1 — **Workflow entrypoint (this doc's core):**

1. `src/bridge.ts`: extract `VoiceReplyGenerator` seam; move the agent loop into
   `createAgentReplyGenerator`; make `MastraVoiceAgent` take a generator. Keep
   `createMastraVoiceAgent({ agent })` behaviour identical.
2. `src/workflow-generator.ts`: `createWorkflowReplyGenerator` + `unwrapStepText`.
3. `src/worker.ts`: resolve `generate` / `workflow` / `agent`; add `workflowInput` / `replyStep`
   / `resultText`; thread `tracingContext` into the workflow run.
4. `src/index.ts`: export the new types/functions.
5. Tests (colocated vitest, `pnpm --filter @mastra/livekit test`):
   - `workflow-generator.test.ts`: string-output and `text-delta`-output unwrapping; `replyStep`
     filtering; `resultText` fallback; cancel → `run.cancel()`; error propagation vs. silent
     barge-in.
   - `bridge.test.ts`: agent path unchanged; generator seam delegates correctly.
6. Docs: `README.md` workflow section + `docs/voice/livekit.mdx` / `reference/voice/livekit.mdx`;
   add a changeset (minor — additive).

Phase 2 — **Transcript-fidelity memory (follow-up):** subscribe to LiveKit transcript events in
the worker; persist spoken turns via `voice-thread.ts`; make it the source of truth for both
generators; document re-enabling Memory with workflows.

## Migration mapping for Plancraft

| Their construct (PR #21818)                                     | New `@mastra/livekit` equivalent                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `responsesWs.ts` (OpenAI Responses ⇄ workflow glue)             | Deleted — handled by the worker + bridge                                        |
| `runId ↔ response_id` mapping                                   | Not needed — one run per turn                                                   |
| `phoneConversation` long-lived run, suspend at `awaitUserInput` | `phoneConversation` run-to-completion per turn; LiveKit owns the turn boundary  |
| `resumeStream({ resumeData: { history } })`                     | `workflowInput: ({ chatCtx }) => ({ history: chatContextToMessages(chatCtx) })` |
| `generateResponse` step `pipeTo(writer)`                        | Unchanged — same `writer` pattern                                               |
| `workflow-step-output` → `response.output_text.delta`           | Unwrapped by `createWorkflowReplyGenerator`                                     |
| State race fixed by overwriting `state.history`                 | Eliminated — no state carried between turns                                     |
| Mastra Memory removed                                           | Re-enable via Phase 2 transcript-fidelity persistence                           |

What they keep re-architecting: the conversation orchestration workflow itself (intent /
qualification / contact / callback steps) is unchanged — it just loses the `awaitUserInput`
suspend step and the transport glue.

## Alternatives considered

- **Long-lived suspended workflow per call (Plancraft's current model).** Rejected for v1:
  suspend/resume round-trips the snapshot through storage every turn, is last-write-wins with no
  CAS/locking (the documented source of their race), and needs an out-of-process transport to be
  worthwhile. The run-to-completion model gives the same "turn = workflow" ergonomics without
  these hazards.
- **OpenAI-Responses server helper fronting a Mastra agent/workflow.** Genuinely valuable — it's
  how Plancraft deploy (LiveKit worker separate from the Mastra backend) and would let them drop
  even more glue. But it's a larger, independent feature (an HTTP/WS server, auth, the Responses
  event protocol). Tracked separately; the `generate` escape hatch lets such a bridge be plugged
  in the meantime.
- **Workflow returns final text only (no streaming).** Supported as the `resultText` fallback,
  but not the recommended path — it sacrifices TTFT, which callers feel directly on a phone line.

## Open questions

1. `workflowInput` required vs. a shipped default shape — lean "required, with a documented
   recommended default" to avoid silent input-schema mismatches.
2. `replyStep` filtering default — stream _all_ text outputs (simple, but interleaves if
   multiple steps write) vs. require `replyStep`. Lean "all by default, `replyStep` to
   disambiguate."
3. Should `toolFeedback` (agent-only today) have a workflow analogue, or do we tell workflow
   authors to `writer.write()` their own filler? Lean the latter — the workflow already controls
   its output stream.
4. Confirm the exact `run.stream()` option name for tracing context during implementation
   (`tracingContext` vs. `tracingOptions`) and that workflow runs accept an external span as
   parent.
