# @mastra/observability

Monitor Mastra agents, workflows, tools, and model calls with hierarchical traces, automatically extracted metrics, and structured logs correlated to the active trace.

## Installation

```bash
npm install @mastra/observability
```

## Usage

```typescript
import { Mastra } from '@mastra/core';
import { Observability, MastraStorageExporter, MastraPlatformExporter } from '@mastra/observability';

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
      },
    },
  }),
});
```

## Documentation

`Observability` instruments agent runs, model generations, tool and MCP calls, processor execution, workflow runs, and workflow steps. Each configured observability instance has its own service name, exporters, sampling strategy, and span processors.

Exporters receive tracing events through the central observability bus. `MastraStorageExporter` persists them to the configured Mastra storage so Studio can query them, while `MastraPlatformExporter` sends them to Mastra Platform. Additional packages provide exporters for services such as Arize, Braintrust, Langfuse, LangSmith, Sentry, and OpenTelemetry-compatible backends.

A `SensitiveDataFilter` output processor is enabled by default and redacts common secrets before spans reach exporters. Set `sensitiveDataFilter: false` to disable it, or provide filter options to customize its behavior. Sampling can retain every trace, use a ratio, or apply application-specific logic.

The package automatically derives duration, status, model token, and cache token metrics from span lifecycle events. Structured logs inherit trace and span IDs, tags, and entity metadata, while metric labels pass through cardinality filtering to prevent user IDs, trace IDs, and other unbounded values from overwhelming metrics backends.

- [Observability documentation](https://mastra.ai/docs/studio/observability)

## Native execution outcomes (OBS-724, implementation in progress)

[OBS-724](https://linear.app/kepler-crm/issue/OBS-724) is the authoritative proposal. This implementation builds on the eight supplied fields in [OBS-722](https://linear.app/kepler-crm/issue/OBS-722), incorporating its draft PR #28389 at `c67bd0f718c5861a9d8193d2354371200727d494`. Earlier local six-field proposals are historical context. Platform integration and proposal updates in Linear are separate, outstanding work.

### Contract and scope

The shared [outcome contract](../../packages/core/src/observability/types/outcome.ts) defines `outcome`, nullable `stopReason`, and nullable, strongly typed `stopReasonContext`. Lifecycle options, exports, snapshots, storage records, SDK responses, and CLI query contracts carry these fields.

| Outcome       | Meaning                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| `success`     | This execution completed normally.                                                         |
| `error`       | This execution failed; the reason distinguishes runtime and model failures.                |
| `abort`       | The caller canceled or explicitly stopped this execution.                                  |
| `interrupted` | Another execution or an authoritative runtime lifecycle boundary stopped this execution.   |
| `suspend`     | This segment paused for later continuation.                                                |
| `limit`       | A resource or execution limit prevented continuation.                                      |
| `blocked`     | A guardrail, content policy, authentication, or authorization rule prevented continuation. |
| `unknown`     | The producer explicitly cannot establish the outcome.                                      |
| `null`        | An adopted producer reports an ongoing execution.                                          |

Missing producer fields mean unavailable, not ongoing or successful. Storage creates normalize missing fields to null, so historical stored nulls cannot establish that execution is ongoing. Updates distinguish omission from explicit null. There is no historical backfill.

Each outcome describes its own span. A successful provider inference can belong to a blocked model step; a failed tool can belong to an agent that recovered successfully. A suspended segment ends permanently, and resume creates another execution with its own outcome. Completed spans retain their outcome when a parent fails or cancellation arrives later.

```typescript
import { SpanType } from '@mastra/core/observability';

const span = instance.startSpan({ name: 'execution', type: SpanType.AGENT_RUN, outcome: null });
span.end({ outcome: 'abort', stopReason: 'caller_cancelled', stopReasonContext: null });
```

Here `instance` is the configured observability instance. `end({ endTree: true, ... })` reports the cause on the current span and cleans up descendants without inventing their outcomes. `endTree(options)` explicitly applies the options to every open descendant; use it only when those facts apply to every affected execution.

### Runtime mapping and typed detail

Every context has a `reason` discriminator matching its reason code. Reason-specific facts are optional unless stated otherwise. Contexts may also contain `signals`, using the serialized `AgentSignalDataPart['data']` transport shape.

| Runtime boundary                                               | Outcome / reason                                                                 | Context facts                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Another agent step is needed but denied by `maxSteps`          | `limit / max_steps`                                                              | `maxSteps`, `completedSteps`                                        |
| Provider output reaches its token limit                        | `limit / max_tokens`                                                             | `maxTokens`                                                         |
| Framework deadline expires                                     | `limit / timeout`                                                                | `timeoutMs`, `timeoutType` (`step`, `total`, or `firstChunk`)       |
| Runtime failure                                                | `error / runtime_error`                                                          | `provider`, `errorCode`, `retryable`, `message`                     |
| Provider request or generation failure                         | `error / model_error`                                                            | Same failure facts                                                  |
| Caller cancellation                                            | `abort / caller_cancelled`                                                       | `message`                                                           |
| Observer failure stops the primary                             | `interrupted / observer_failed`                                                  | Required nested `cause: SpanTermination`; optional `observerSpanId` |
| Structured observer/provider context exhaustion                | `limit / context_window_exceeded`                                                | Failure facts, `model`, `contextWindow`                             |
| Processor tripwire                                             | `blocked / guardrail`                                                            | `processorId`, `message`                                            |
| Provider content filter                                        | `blocked / content_filter`                                                       | `provider`, `message`                                               |
| Approval pauses execution                                      | `suspend / approval_required`                                                    | `toolCallId`, `toolName`                                            |
| Authentication / authorization denial                          | `blocked / authentication` or `blocked / authorization`                          | Failure facts                                                       |
| A queued signal replaces a request                             | `interrupted / signal_received`                                                  | Signals admitted at the interruption boundary                       |
| Explicit stop predicate, iteration hook, or delegation bailout | `abort / stop_condition`, `abort / iteration_hook`, or `abort / delegation_bail` | Iteration hooks may include `feedbackCompleted`                     |

The additional codes `signal_received`, `stop_condition`, `iteration_hook`, and `delegation_bail` are implementation refinements that still need proposal review in Linear. No runtime diagnostic text is used to infer structured provider codes. Authentication and authorization denials take precedence over inconsistent context-limit/content-filter codes. Durable failure envelopes are unwrapped before classifying their original cause; traversal is cycle-safe.

Successful completion on the final allowed step remains success. A guardrail retry that recovers also leaves the parent successful, while the rejected attempt retains its own block. Generic workflow/tool suspension has no approval reason. With Observational Memory `failurePolicy: 'continue'`, the observer keeps its failure but the primary can succeed. With abort policy, the primary preserves the observer's limit or policy-block cause inside `observer_failed` context.

Signal context preserves serialized identity, timestamps, text/file contents, attributes, metadata, author, and provider options. File data uses its transport string representation. Older signal callbacks without payload remain compatible. Ordinary signal delivery does not by itself establish a terminal cause; attribution currently covers request preemption.

### Instrumented producers

| Producer                                                        | Implemented boundaries                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Normal, durable, evented, filesystem-routed, and Inngest agents | Ongoing and terminal agent/model-generation outcomes, continuation limits, retries, deadlines, caller cancellation, approvals, processor tripwires, observer causes, request preemption                                                          |
| Model steps and inference attempts                              | Explicit ongoing null, provider completion before output processing/tools, token/content limits, provider failures, input-step/request/response guardrails, suspension, cancellation and deadlines; completed inference results remain unchanged |
| Tools and MCP tools                                             | Their own completion, failure, validation failure, and suspension, independently of subsequent agent recovery                                                                                                                                    |
| Default, evented `start`/`startAsync`, and Inngest workflows    | Root/step success, failure, bail, recovered retry, guardrail, cancellation, suspension/resume; typed causes propagate through nested results                                                                                                     |
| Parallel, conditional, until/while, foreach, and waits          | Container, item/body, predicate, and wait boundaries; distinct resumed blocks; completed peers are preserved                                                                                                                                     |
| Default executor yielding                                       | `interrupted`, preserving public `waiting` status and already completed work                                                                                                                                                                     |
| Durable/evented agent recovery                                  | Abandoned agent/model-generation executions end as interrupted; recovered executions have separate identities                                                                                                                                    |

True and false predicate results are successful evaluations. Conditional predicate failure retains its runtime error even when the existing false-branch fallback lets the workflow succeed. Thrown loop conditions retain their failure while completed bodies stay successful. Evented dynamic wait calculation errors retain their cause while its existing zero-duration fallback can recover. Unselected branches emit no execution. Public workflow statuses and existing fallback behavior remain unchanged.

### Persisted workflow handoff

In-memory, LibSQL, and PostgreSQL workflow stores opt into `supportsWorkflowSpanSnapshots()`. They atomically merge checkpoints by trace/span identity, preserve the first completed snapshot, reject mismatched identities, and retain checkpoints across full snapshot writes. The active `executionSpan` pointer is separate from resume lineage in `tracingContext`.

Evented callers checkpoint roots before dispatch. Workers restore them through the saved observability registration key, including aliases, and can complete them after caller loss. Steps, waits, control-flow containers, predicate evaluations, and nested invocation wrappers/roots also checkpoint their identity and completion. A replacement worker can cancel these unfinished executions using their original identities and exporter, even when the fresh caller has no observability configured. Completed peers and their timestamps remain unchanged. Child roots and wrappers are saved before nested dispatch; cancellation follows child references, and a delayed child start cannot reopen a canceled child.

Inngest checkpoints roots, steps, and control-flow spans. A separate worker cancellation function closes unfinished checkpoints when `cancelOn` stops the execution function. Nested parent checkpoints retain child workflow/run identity before dispatch, allowing recursive cancellation and prevention of delayed canceled child execution. Explicit suspended continuations can resume on replacement workers with distinct execution identities.

Completion is prepared without export, persisted, then emitted through the normal filters and processors. The winning durable operation can replay its stored completion. This is not an exactly-once export/metrics guarantee or a transactional outbox: a crash between persistence and export requires replay of the winning operation to deliver that completion. Worker disappearance or drain timeout alone does not establish interruption, because already dispatched handlers may still run.

Evented guarded status writes prevent delayed cancellation from rewriting completed runs. Terminal notifications carry execution identity; workers and caller listeners reject notifications for another active root. Legacy events without identity retain existing behavior. This is not a general ownership-generation protocol, and broader conflicting terminal writes remain outside the verified guarantees.

Handoff requires persisted parent/child workflow snapshots, a checkpoint-capable store, and observability completion support. Snapshot opt-outs, unsupported stores, and spans created outside these lifecycle hooks do not gain the same guarantees.

### Export, storage, and queries

The eight OBS-722 fields are `externalParentSpanId`, `resumedFromSpanId`, `model`, `provider`, `outcome`, `stopReason`, `timeToFirstTokenMs`, and `errorCount`. Supplied values survive ordinary round trips; enabling the contract does not automatically populate every field. OBS-724 adds typed `stopReasonContext` alongside them. No `hasError`, `duration`, or `guardrailTriggered` column is introduced.

The storage and Platform exporters preserve native fields in their OSS payloads. In-memory, DuckDB, PostgreSQL vNext, and ClickHouse vNext storage preserve nested observer causes and signal context. Context is nullable JSON detail (JSON text in ClickHouse). Existing sorting/partition keys remain unchanged. Additive schema upgrades must precede new-column writes; Platform collector/writer/schema deployment has not been performed here.

Trace and branch list filters accept exact native `outcome` and `stopReason`. A trace filter applies to its root; a branch filter applies to its anchor. Combined fields must both match. Advanced queries support root/related-span predicates, direct span queries, thread qualification, and value discovery. Missing values never inherit legacy success status. Context is detail-only, not a filtering dimension.

```typescript
const limited = await observabilityStore.listBranches({
  filters: { outcome: 'limit', stopReason: 'context_window_exceeded' },
});
```

Lightweight lists/timelines include outcome and reason; `getSpan` provides context. SDK and CLI contracts expose the filters and typed responses. DuckDB reconstructs mutable fields before matching, including explicit nulls that clear provisional failures. ClickHouse matches current span versions and restricts reconciliation to candidate traces. Equal-version conflicting writes remain unresolved.

### Validation and remaining work

Runtime scenarios use real agents, processors, storage, and HTTP mock LLMs. Inngest cases use its real dev server. Workflow recovery tests use separate processes, file-backed LibSQL, and explicit worker termination; shared guarded-runtime tests also run against isolated PostgreSQL. Tests assert exported/persisted outcomes, original identities, context, timestamps, and preservation of completed peers.

Relevant suites:

- [Agent outcomes](../../packages/core/src/loop/test-utils/aimock/scenarios/native-outcomes.scenario.test.ts), [observer causes](../../packages/core/src/loop/test-utils/aimock/scenarios/observer-outcomes.scenario.test.ts), and [signal context](../../packages/core/src/loop/test-utils/aimock/scenarios/signal-outcomes.scenario.test.ts), shared across five engines.
- [Workflow control-flow scenarios](src/test-utils/workflow-control-flow-suite.ts) and [evented process handoff](src/workflow-remote-tracing.test.ts).
- [Inngest native workflows](../../workflows/inngest/src/__tests__/workflow-native-outcomes.test.ts) and [cross-process continuation/cancellation](../../workflows/inngest/src/__tests__/workflow-cross-process-outcomes.test.ts).
- [Shared storage round trips](../../stores/_test-utils/src/domains/observability-vnext/index.ts), native query suites, and adapter migration tests.
- [Workflow checkpoint storage contract](../../stores/_test-utils/src/domains/workflows/span-checkpoints.ts), including concurrent full-snapshot writes.

The final storage audit passes 439 DuckDB observability/query/migration tests and 213 lifecycle/export/rebuild checks. The real HTTP exporter agreement suite checks all eight native fields plus nested observer context and signals under all three storage export strategies. Removing context from the Platform payload makes all three cases fail at the received-payload assertion.

The final agent audit passes 115 core scenario/classification checks and 27 Inngest scenarios after correcting an observer capture exporter's missing `flush()` method. The latest nested-workflow validation passes 351 local/process workflow cases and 103 PostgreSQL cases. Three replacement-worker nested scenarios plus delayed-dispatch cancellation passed 20 repetitions each locally; PostgreSQL delayed-dispatch cancellation passed 20 repetitions. These results establish the covered boundaries, not arbitrary cross-worker reconciliation.

Remaining work before claiming full OBS-724 completion:

- Update the authoritative Linear proposal with final reason codes and design decisions after review; no Linear changes have been made by this implementation.
- Integrate and deploy Platform ingestion/storage with the nullable native fields and context, and coordinate rollout with OBS-722. Validate third-party exporter mappings separately where their backends support these fields.
- Complete active ownership-transfer and concurrent mixed-cause reconciliation coverage. Restoring unfinished timers is not implemented; replacement-worker cancellation is covered. External-placeholder creation and trace/thread representative selection remain coordinated with OBS-607/608 rather than inferred here.
- Extend signal attribution and provider/observer cases beyond the tested boundaries, and audit spans created outside instrumented lifecycle hooks.
- Validate TimescaleDB/pg_partman-specific upgrades and additional adapters. The separate memory integration harness remains unavailable because its lockfile/configuration and unpublished internal dependency prevent installation; the observer scenarios use real in-memory storage.
- Resolve the existing public Inngest polling race that can expose an intermediate failed step before final tripwire status. Native tests await finalized storage/exports; they do not claim that public-status race is fixed.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/mastra/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
