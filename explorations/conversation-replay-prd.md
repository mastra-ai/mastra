# Whole conversation replay

**Status:** Implementation specification
**Audience:** Coding agent implementing the next increment of Golden Thread Replay
**Prerequisite:** Build on the existing `codex/golden-thread-replay` changes, including the thread importer, memory seeds, lookup tool mocks, and Studio replay views. Those changes may still be uncommitted in the worktree. Preserve them.

## Product goal

Let an engineer replay a recorded conversation against a candidate agent configuration and see whether earlier candidate decisions cause later regressions. Each conversation runs on its own thread and resource. Candidate replies, tool interactions, and memory updates carry forward between turns.

Extend the existing dataset and experiment flow. A conversation is one dataset item, one execution attempt, and one experiment result containing turn details. The default remains independent-turn replay.

The first release is scripted replay: send the recorded user messages in their original order. It does not adapt user messages when the candidate asks different questions.

## Scope and design constraints

The implementation must add the smallest coherent capability to the existing APIs:

- Add one optional `mode: 'turns' | 'conversation'` to the existing thread-import helper and its existing preview/import HTTP requests. Omission means `'turns'`.
- Keep `datasetItemsFromThread`, `addDatasetItemsFromThread`, `previewReplayDataset`, and `dataset.startExperiment`. Preserve their existing call shapes and return conventions.
- Represent a conversation inside the existing JSON `input` field. Use the existing `memorySeed`, `groundTruth`, `expectedTrajectory`, `toolMocks`, scorer resolution, and result storage wherever their semantics apply.
- Add typed conversation input and nested turn output shapes. Do not introduce a conversation class, separate runner service, new target type, new endpoints, new tables, or a parallel SDK.
- Keep orchestration helpers private. Export only the types needed to author or consume the new payload.
- Do not add an `expectations` DSL, new scorer registration system, pass/fail policy engine, user simulator, sandbox framework, or configuration comparison system in this increment.

A small internal refactor is appropriate when it removes duplicate execution behavior. Avoid redesigning `runEvals` or moving large unrelated subsystems. This is experiment orchestration; it should not require agent-loop or processor API changes.

## User journey

1. Open a recorded thread and choose **Create replay dataset**.
2. Choose **Independent turns** or **Whole conversation**. Independent turns remains selected by default.
3. The preview says either “10 turns → 10 test cases” or “10 turns → 1 conversation”.
4. Create the dataset or add the item to an existing compatible dataset.
5. Run the existing experiment flow with the selected agent/model and scorers.
6. Open the conversation result to inspect turns in order, their replies, tools, working memory, and scores.
7. Compare two experiments on the same conversation item using the existing comparison flow.

The selector should explain the distinction in one sentence per option: independent turns use recorded history before each turn; whole conversation carries the candidate's history forward. Conversation mode should also explain that user messages are fixed.

## Public API contract

The intended usage is:

```ts
const items = await datasetItemsFromThread({
  memory,
  threadId: 'golden-thread',
  mode: 'conversation',
});

await dataset.addItems({ items });

await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support',
  scorers: ['trajectory', 'similarity'],
});
```

This is the proposed extension. `mode: 'conversation'` is not implemented by the prerequisite PR.

The helper continues to return an array. For N completed source turns, `'turns'` returns N items and `'conversation'` returns one item. Both return an empty array when there are no completed turns. Preview/import `turnCount` still means source turns; the import response's `itemIds.length` gives created items. No new response counter is required.

Keep existing TypeScript inference for callers that omit `mode` or pass `'turns'`. A conversation-specific overload and a union overload for a dynamic mode are acceptable; existing callers must not suddenly receive a wider input type.

`historyLimit` remains a setting for independent-turn imports only. Conversation mode follows the candidate agent's configured history policy. Hide the history-window controls in Studio for this mode and reject an explicitly supplied `historyLimit` with a clear schema validation error. Do not silently ignore it or invent a second history-control API.

**Compatibility trap:** replay `historyLimit: false` currently means all recorded prior messages, while memory `lastMessages: false` disables history. Never pass one directly into the other.

## Stored conversation shape

Use a discriminated envelope in the existing `input` JSON. The following shape is normative at the semantic level; compose schemas and types from existing definitions rather than reproducing them:

```ts
{
  input: {
    type: 'conversation',
    turns: [
      {
        input: [userMessage],
        groundTruth: originalAssistantReply,
        expectedTrajectory: recordedTrajectory,
        toolMocks: recordedToolMocks,
      },
    ],
  },
  memorySeed: { workingMemory: initialWorkingMemory }, // omit if unavailable
  toolMockMatchMode: 'lookup',
  unmockedToolPolicy: 'deny',
  source: { type: 'thread', referenceId: sourceThreadId },
  metadata: { replay: { /* mode and existing source provenance */ } },
}
```

Requirements:

- Dispatch on the validated input discriminator for agent targets, not arbitrary metadata or the mere presence of a `turns` property. Workflow/inline-task JSON inputs retain their existing meaning.
- Each turn's input contains its recorded user message, preserving supported message parts such as attachments. No original assistant replies, tool-result messages, later signals, or per-turn memory snapshots enter candidate history.
- Preserve original replies and trajectories only as grading/display references. Keep source turn/message identifiers and unresolved recorded tool calls in replay provenance.
- Reconstruct initial working memory only up to the first selected turn's entry boundary, using the existing reconstruction helper. Seed it once. If unavailable, keep the candidate's existing template-default behavior.
- Import the full completed conversation; turn ranges and mid-conversation starts are out of scope. Reuse existing turn extraction/completion behavior, including skipping an unanswered trailing user message.
- Strip original message/thread/resource identifiers from executable messages, just as independent replay does. Never add source identifiers to candidate request context.
- Imported conversation items use per-turn mocks and references. Reject ambiguous duplicate top-level `toolMocks`, `groundTruth`, or `expectedTrajectory` on this envelope; do not invent precedence rules.
- Conversation replay requires lookup matching and deny-unrecorded behavior. Reuse the existing fields and matcher, validate incompatible explicit values, and never allow experiment defaults to enable live external tools for this input.
- Validate a nonempty turns array, valid message shapes, mock shapes, and incompatible fields in schemas. Perform memory availability, ownership, and target checks at runtime.

The existing generic dataset-input schema still applies. Adding to a dataset with an incompatible schema must fail through existing validation rather than altering that dataset's schema automatically.

## Execution semantics

Treat the conversation as the existing experiment runner's unit of work. Run-level/item-level hooks, concurrency, persistence selection, cancellation, retries, and events keep their current boundaries. A ten-turn conversation counts as one item, not ten successful items.

For each attempt:

1. Resolve the agent and existing experiment options once. Apply the same model/version/request context configuration on every turn.
2. Require a configured memory store for this first release. Fail clearly before any model call if it is absent; do not silently execute isolated turns. Honor the configured recall/truncation policy, including intentionally disabled message recall.
3. Allocate a fresh thread and resource, reject caller-supplied production thread/resource IDs as current replay does, and restore the initial memory seed once.
4. For each turn, check cancellation, install a fresh matcher containing only that turn's recorded tools, and call the existing agent generation path with only that turn's user input.
5. Let ordinary memory processing persist/recall candidate messages and memory updates. Do not also manually append the whole transcript: that duplicates history. Never restore original memory between turns.
6. Capture the turn's output, tools, working memory before/after, trace ID, usage, and mock report. Await completion before sending the next input.
7. Return the accumulated turn records and final working memory through the existing result pipeline.

Conversations may run concurrently; turns within a conversation must be sequential. Keep matcher state, memory, and transcripts local to the attempt, never on a shared agent instance. Retrying an execution failure restarts the conversation with a fresh thread/resource and fresh mocks. Do not retry from a partially mutated conversation. Do not add automatic retries for low scores.

Reuse the existing `itemTimeout` as the conversation item's execution budget, subject to the runner's existing retry/timeout semantics. Do not add turn-specific timeout, retry, or scheduling knobs. On a fatal generation/storage error or cancellation, retain completed turn evidence, record where execution stopped, and do not send remaining user messages. Incomplete turns must not look successful.

### Recorded tools and missing evidence

Use the existing tool interception hooks. Working-memory tools run against isolated candidate state; other tools receive recorded results. Preserve current handling of sub-agent recordings. A mock from a future turn must never satisfy an earlier call, even if names/arguments match.

Lookup misses retain their current behavior: return the recorded-result-unavailable error to the agent, record the miss, and allow the model to recover. Display missing recordings prominently at both turn and conversation level. A numeric score or completed execution must not be presented as proof of a valid replay when required recordings were unavailable. Keep the distinction visible through existing mock reports; a general inconclusive-verdict API is outside this increment.

Recorded tool outputs do not simulate an external database. This feature can verify the calls an agent attempted; it cannot establish that an external write succeeded. Do not present mocked success responses as verified business outcomes.

## Scoring and result persistence

Reuse the selected experiment/item/dataset scorers and their existing precedence. In this release, evaluate those scorers against each executed turn using that turn's input, candidate output, original reply, and expected trajectory. This preserves the meaning of existing answer-similarity and trajectory scorers.

- Store per-turn `ScorerResult` values inside the conversation's nested output, using existing score/error/not-scorable representations.
- Produce one aggregate score per selected scorer for the conversation item using the arithmetic mean of available numeric turn scores. Show the scored-turn count and any missing/error outcomes. If no numeric turn scores exist, keep the aggregate unscored; do not fabricate zero or a pass.
- Persist aggregate scores through existing experiment score identities, once per conversation item/attempt/scorer. Nested scores must not create duplicate item-level score rows, inflate dataset counts, or collide under the existing stable score key.
- An average is a summary metric, not a guarantee that all turns passed. Always retain visible individual failures. Do not introduce a new universal conversation verdict.
- Score completed evidence on an interrupted run where supported, while retaining the execution error and incomplete state. Never score unexecuted turns against empty generated answers.
- Ensure each trajectory scorer receives the correct turn's entire tool trajectory. A final-turn trace is not the whole conversation; previously recalled messages must not be counted again as new tool calls.

Extend `AgentExperimentOutput` with nested turn results, reusing its current output fields and scorer/mock-report types. Keep top-level `text`/structured output as the last completed answer for compatibility. Top-level working memory is final candidate memory. Usage and duration represent all executed turns, not only the final generation. Preserve unavailable metrics as unavailable. Every executed turn retains its own trace link.

Persist the immutable replay references needed for display with the result. Existing experiment pages must remain accurate if the dataset is subsequently edited. Reuse existing JSON payload storage, snapshots, and versioning; no new tables or per-turn result entities are needed.

## Studio and API integration

Extend the existing preview/import request schemas with the optional mode; keep authorization and thread ownership checks unchanged. Update generated SDK route types and CLI route metadata using repository generators. Keep all existing client method names and experiment start routes.

Reuse the result panel and comparison components. A conversation row opens a turn selector or simple ordered list. The selected turn uses the existing production/candidate comparison for replies and tools, with initial/current memory labeled accurately. Show turn scores, missing recordings, and the point where an incomplete run stopped.

Compare conversation results by stable dataset item identity and source turn index, never by generated text or incidental result order. Do not align independent-turn and conversation results as if their item units were interchangeable. Existing independent-turn screens and saved results remain readable.

The initial UI needs no separate conversation dashboard, new navigation area, or live turn-streaming protocol. Existing experiment progress can remain item-based while a conversation runs.

## Implementation map and reuse

Paths below are relative to the repository worktree.

| Area | Existing entry points | Intended change |
| --- | --- | --- |
| Thread import | `packages/core/src/datasets/replay/from-thread.ts`, `working-memory.ts` | Reuse extraction and initial-state reconstruction; add mode and conversation envelope. |
| Multi-turn execution | `packages/core/src/evals/run/index.ts` (`runAgentTurns`) | Reuse/refactor the private sequential-turn mechanics where practical. Preserve current `runEvals` behavior. |
| Experiment execution | `packages/core/src/datasets/experiment/executor.ts`, `index.ts`, `item.ts` | Add a conversation branch and shared execution path used by both full-run and run-item APIs. |
| Tool interception | `packages/core/src/datasets/experiment/tool-mocks.ts` and existing hook builder | Fresh matcher per turn; reuse lookup diagnostics and memory-tool handling. |
| Scoring | `packages/core/src/datasets/experiment/scorer.ts` | Reuse scorer execution with per-turn inputs; persist one conversation aggregate. |
| Server and client | Existing dataset schemas, handlers, routes, and client methods | Extend existing contracts and regenerate derived types. |
| Studio | Existing replay creation dialog, `replay-result.tsx`, replay utilities, experiment comparison | Add mode selection and nested turn inspection. |
| Storage | Existing dataset snapshots and result JSON serialization | Round-trip the nested shapes without new schema columns. |

Do not call `runEvals` as an opaque nested experiment runner. It currently owns its own thread/resource decisions and scoring lifecycle. Share the smallest useful private mechanics while letting the dataset runner retain ownership of isolation, hooks, persistence, and error handling.

## Acceptance criteria

Use the repository's real-world testing guidance. Exercise real Agent, Memory, tools, storage, and public execution APIs; simulate the paid model at the wire boundary. Extend shared suites and use common fixtures across the in-process experiment and run-item paths.

1. **Default compatibility:** Existing independent-turn imports, outputs, scorer behavior, and TypeScript callers are unchanged when mode is omitted.
2. **Import cardinality:** A ten-turn thread yields ten independent items or one conversation item. No completed turns yields zero items. Source data is unchanged.
3. **Candidate continuity:** Inspect the actual next model request: it contains the candidate's earlier response and tool results, contains the next recorded user message, and does not contain the original assistant response as candidate history. No duplicate message history is injected.
4. **Memory propagation:** An early candidate working-memory update is visible later. The original later-turn snapshot never overwrites it. A deliberately incorrect update produces a later failing score, while independent-turn replay from the recorded correct seed succeeds.
5. **Isolation:** Concurrent conversations and repeated runs cannot see one another's history or memory. Original thread/resource memory is unchanged, including resource-scoped working memory.
6. **Tool boundaries:** Identical tool calls recorded with different outputs in different turns receive their own turn's output. Future-turn recordings are inaccessible. A missing recording never executes the real tool and is visible after reload.
7. **Scoring integrity:** Each turn is graded against its own reference; early tools are included in that turn's trajectory. Aggregates include all scored turns, remain unscored when appropriate, and create only one item-level score per scorer. Failed/unscored turns stay visible.
8. **Failure and retry:** A failure on turn 3 preserves turns 1–2, identifies the interruption, and does not execute turns 4 onward. An allowed retry uses fresh state. Cancellation cannot start another turn.
9. **Configuration consistency:** Every turn receives the existing model/version/context overrides. Missing memory fails before a model call. Unsupported execution paths fail explicitly rather than degrading to isolated turns.
10. **Round trip:** Import over real HTTP, run, reload results, export/import the dataset through the existing snapshot path, and run again without losing turns, mocks, provenance, or initial memory. Keep existing adapter limitations explicit; MySQL tool-mock support is not added here.
11. **UI:** Creation shows correct counts; conversation results expose turn details and incomplete/missing-evidence states; two runs align correctly. Follow existing MSW-first UI testing, then a focused browser journey.
12. **Handoff:** Document the mode, scripted-user limitation, history behavior, and score aggregation. Include appropriate package changesets, passing focused checks, desktop/tablet/mobile screenshots, and a short captioned video of creating, running, and comparing a conversation replay.

Read the most-specific `AGENTS.md` and applicable testing/frontend/docs skills before implementation. Run focused unit/integration tests before E2E, build only affected packages/dependencies, and follow the repository changeset command. Do not modify examples.

## Explicit limits of the first release

Scripted user messages may depend on the original assistant's wording. Explain this in the creation flow and documentation; select suitable test conversations. Do not rewrite user messages, infer branches, or add an LLM user simulator.

Only the initial recorded working memory is restored. Observational memory, semantic recall corpora, external service state, source-environment clock values, and arbitrary runtime context are not reconstructed. Candidate memory behavior runs according to the target configuration and available isolated data.

New requirements for adaptive users, stateful external-tool environments, final-state assertion APIs, confidence intervals, configurable repetition scheduling, or CI verdict policies should be separate increments. This implementation is complete when one existing dataset experiment can execute a recorded conversation continuously and expose reliable turn-level evidence using the current platform primitives.
