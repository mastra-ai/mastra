# Tool Replay / Mocking for Agent Experiments — Exploration & Implementation Report

**Issue:** [#17466](https://github.com/mastra-ai/mastra/issues/17466) — Datasets/Experiments: native tool replay/mocking for agent targets (deterministic eval of agents with side-effecting tools)
**Branch:** `tool-replay-mock-setup`
**Date:** 2026-06-09
**Status:** Exploration complete; design agreed (static v1); implementation not yet started.

---

## 1. Problem

For `targetType: "agent"`, experiments re-run `agent.generate()` with **live tool execution**. For agents that read/write mutable external state (support tickets, CRM, orders), this causes:

- **Non-determinism** — eval results vary as external state changes.
- **Real side effects during eval** — writes hit production systems.
- **No faithful re-run** — a recorded trace can't be replayed against the same point-in-time tool outputs.

### Current workaround (per-project glue)

Recorded read responses from `extractTrajectoryFromTrace` are stuffed into an item's `requestContext`, and a generic HTTP tool checks for them. This is custom glue per tool/project — exactly what the issue asks to make native.

---

## 2. Existing building blocks (already in the codebase)

The point-in-time eval foundation already exists:

- **Per-item `requestContext`** — `DataItem.requestContext` (`datasets/experiment/types.ts`).
- **SCD-2 item versioning** — items are versioned, so "the state at capture time" is addressable.
- **Trajectory extraction** — `extractTrajectoryFromTrace(spans, rootSpanId?)` at `packages/core/src/evals/types.ts:902`. Builds a parent/child span tree and emits `tool_call` steps exposing `toolArgs` / `toolResult`. This is the natural data source for recorded tool outputs.
- **Agent injection points** — `agent.generate()` accepts `toolsets`, `clientTools`, `toolChoice` overrides (`agent.types.ts`); tool execution itself runs through `CoreToolBuilder.createExecute` (`tool-builder/builder.ts`).

### The gap

`executeAgent()` (`datasets/experiment/executor.ts`) always runs real tools/model — there is **no mock/replay hook**. Tool replay slots in where the agent target is executed, intercepting tool execution per item.

---

## 3. Issue proposals (in author's order of preference)

1. **Native tool replay in experiments** — option on `startExperiment` / the item to supply recorded tool outputs keyed by `(toolName, args)`. Data shape already exists via `extractTrajectoryFromTrace`.
2. **Replay-from-trace mode** — given a captured trace, auto-stub tool execution from that trace's tool spans, with a configurable miss policy (error / passthrough).
3. **Minimum** — a documented per-run tool-execution interception hook, so users implement replay once instead of monkeypatching each tool.

---

## 4. Design discussion & decisions

### 4.1 Static recordings vs. function mocks

We evaluated whether the replay value should be a **static map** or a **function** with access to runtime context (like a real tool).

**Function form — pros:** strictly more powerful; enables stateful mocks (e.g. ticket flips `open → closed` across calls), output varying by `requestContext`/args/call count; subsumes proposal #3.

**Function form — cons:** a mock with `mastra` / `requestContext` / network access can re-introduce the exact non-determinism and side effects replay exists to eliminate; determinism becomes the author's responsibility; harder to audit "was this run hermetic?".

**Norm check:** static recorded fixtures are the industry default for replay (VCR, Polly.js, nock; LLM eval frameworks like Braintrust / LangSmith / promptfoo). Function mocks live in **unit tests**, where non-determinism is the goal — not in deterministic replay.

**Decision: ship static v1.** It is serializable (flows through the server schema, persists on the experiment record, renders in the trigger UI), auditable (diff the recording to prove hermeticity), and is the faithful re-run the issue actually asks for. Keep a small `match?` matcher hook as the only escape hatch (covers fuzzy arg matching and satisfies proposal #3 cheaply). A full dynamic `resolve?` can be added later — purely additive, no breaking change.

### 4.2 Miss policy

When a live tool call has no recorded match: `error` | `passthrough` (run real tool) | `noop` (skip; safe for writes). Per-tool overrides allowed (e.g. always `noop` writes).

**Open decision:** default `onMiss`. Leaning **`error`** for this use case — loud drift detection beats silent live calls during eval. (`passthrough` is the non-breaking alternative.)

### 4.3 Match strategy

**Open decision:** match by **args** (deep-equal — robust to call-ordering non-determinism) vs. by **call order** (Nth call to `toolName` — simpler but brittle). Default proposed: toolName + deep-equal args, with `match?` override.

---

## 5. Recommended SDK interface (static v1)

```ts
/** A single recorded tool call: what it was called with, and what it returned. */
export interface RecordedToolCall {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
}

export type ToolReplayMissPolicy = 'error' | 'passthrough' | 'noop';

export interface ToolReplayConfig {
  recordings: RecordedToolCall[];
  /** Default: 'passthrough' (decision open — may default to 'error'). */
  onMiss?: ToolReplayMissPolicy;
  /** Per-tool overrides — e.g. always no-op writes regardless of recordings. */
  tools?: Record<string, { onMiss?: ToolReplayMissPolicy }>;
  /** Escape hatch: custom matcher. Default = toolName + deep-equal args. */
  match?: (
    call: { toolName: string; args: Record<string, unknown> },
    recordings: RecordedToolCall[],
  ) => RecordedToolCall | undefined;
}
```

`ExperimentConfig`, `StartExperimentConfig`, and `DataItem` each gain an optional `toolReplay?: ToolReplayConfig`.
**Resolution order:** `item.toolReplay` overrides `experiment.toolReplay`.

### Usage 1 — manual recordings (run-level)

```ts
const summary = await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  scorers: ['answer-relevancy'],
  toolReplay: {
    recordings: [
      { toolName: 'getTicket', args: { id: 'T-1' }, result: { status: 'open', body: '...' } },
      { toolName: 'searchKb',  args: { query: 'refund' }, result: { docs: [/*...*/] } },
    ],
    onMiss: 'error',
    tools: { createComment: { onMiss: 'noop' } }, // writes never hit prod
  },
});
```

### Usage 2 — replay from a captured trace (proposal #2)

```ts
import { extractToolReplayFromTrace } from '@mastra/core/datasets';

const trace = await mastra.getStorage()
  .getStore('observability')
  .then(s => s!.getTrace({ traceId }));

const summary = await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  toolReplay: {
    ...extractToolReplayFromTrace(trace.spans), // -> { recordings: RecordedToolCall[] }
    onMiss: 'passthrough',
  },
});
```

### Usage 3 — per-item replay (point-in-time; strongest fit for the issue)

```ts
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  data: [
    {
      input: 'Refund my order',
      groundTruth: { resolved: true },
      toolReplay: {
        recordings: [{ toolName: 'getOrder', args: { id: 'O-9' }, result: { total: 42 } }],
        onMiss: 'error',
      },
    },
  ],
});
```

---

## 6. The execution seam

Config flows `runExperiment → executeAgent → agent.generate({ toolReplay })`, and inside `CoreToolBuilder.createExecute` we check the matcher **before** calling `tool.execute`:

```ts
// inside execFunction, before live execution:
if (toolReplay) {
  const hit = (toolReplay.match ?? defaultMatch)({ toolName: options.name!, args }, toolReplay.recordings);
  if (hit) return hit.result;
  const policy = toolReplay.tools?.[options.name!]?.onMiss ?? toolReplay.onMiss ?? 'passthrough';
  if (policy === 'error') throw new MastraError({ id: 'TOOL_REPLAY_MISS', /* ... */ });
  if (policy === 'noop') return undefined;
  // 'passthrough' falls through to live execution
}
```

`extractToolReplayFromTrace` is a thin wrapper over `extractTrajectoryFromTrace` (`evals/types.ts:902`) that collects `tool_call` steps' `toolArgs` / `toolResult` into `RecordedToolCall[]`.

---

## 7. UI surface (playground)

The trigger UI is `packages/playground/src/domains/datasets/components/experiment-trigger/experiment-trigger-dialog.tsx`. It already has Target / Scorer / RequestContext sections.

- Add a **"Tool Replay"** block in the `DialogBody`, gated like scorers (`targetType !== 'scorer'`).
- Three progressive modes: **Off** (live, default) → **Replay from source** (dropdown of past experiments/traces for this dataset → auto-build map via `extractTrajectoryFromTrace`) → **Manual map** (`CodeEditor` JSON of `RecordedToolCall[]`).
- A small Select for miss policy (`error` | `passthrough` | `noop`).
- `handleRun` passes a new `toolReplay` field into `triggerExperiment.mutateAsync`.
- A **"Tool Replay"** badge on experiment rows/detail to visually distinguish replayed runs from live runs (reviewer trust).

The function form, if ever added, is **SDK-only** — it can't serialize, so the deterministic/auditable path (`recordings` + source-trace) is the one exposed in the product.

---

## 8. Implementation checklist (UI → core)

- [ ] **core** — add `RecordedToolCall`, `ToolReplayMissPolicy`, `ToolReplayConfig` to `datasets/experiment/types.ts`; add `toolReplay?` to `ExperimentConfig`, `StartExperimentConfig`, `DataItem`.
- [ ] **core** — `extractToolReplayFromTrace(spans)` wrapper over `extractTrajectoryFromTrace` (`evals/types.ts:902`).
- [ ] **core** — thread `toolReplay` through `runExperiment` → `executeAgent` (`datasets/experiment/executor.ts`) → `agent.generate`.
- [ ] **core** — interception in `CoreToolBuilder.createExecute` (`tool-builder/builder.ts`): match → hit returns result; miss → policy (`error` / `passthrough` / `noop`). New `MastraError` id `TOOL_REPLAY_MISS`.
- [ ] **core** — resolution precedence: `item.toolReplay` over `experiment.toolReplay`.
- [ ] **server** — extend `triggerExperimentBodySchema` (`packages/server/src/server/schemas/datasets.ts:278`) with serializable `toolReplay` (recordings + onMiss + tools; not `match`).
- [ ] **server** — forward `toolReplay` in handler (`packages/server/src/server/handlers/datasets.ts:589`) to `startExperiment`.
- [ ] **client-js** — extend dataset trigger action body type with `toolReplay`.
- [ ] **playground** — `use-dataset-mutations.ts` `triggerExperiment`: add `toolReplay` to payload.
- [ ] **playground** — `ToolReplaySelector` in `experiment-trigger-dialog.tsx` (3 modes + miss policy) + replay badge on experiment rows/detail.
- [ ] **docs** — feature doc + `startExperiment` API reference update (new packages/features require docs per repo guidelines).
- [ ] **changeset** — add per repo convention.

## 9. Verification plan

- [ ] **core unit tests** (colocated, vitest): matcher (hit/miss, deep-equal args, `match?` override), each miss policy, per-tool override, item-over-experiment precedence, `extractToolReplayFromTrace` shape from sample spans. Run `pnpm test:core`; if `@internal/test-utils/setup` fails to resolve, run `pnpm build:core` first.
- [ ] **typecheck**: `pnpm --filter ./packages/core check`.
- [ ] **server**: validate `triggerExperimentBodySchema` round-trips `toolReplay`.
- [ ] **playground**: MSW-based tests (per `playground-msw-tests` skill) for the trigger dialog passing `toolReplay`.
- [ ] **determinism proof**: run the same experiment twice with identical recordings + `onMiss: 'error'` and assert identical outputs and zero live tool calls.

## 10. Open decisions

1. Default `onMiss` — `error` (loud drift; preferred for this use case) vs. `passthrough` (non-breaking).
2. Match strategy — deep-equal args (preferred) vs. call-order (Nth call).
3. Per-item replay UI — ship run-level first; surface per-item in the item editor (`dataset-detail-view.tsx`) later.
4. Whether to persist the resolved recordings on the experiment record for full auditability (recommended).
