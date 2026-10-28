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

[OBS-724](https://linear.app/kepler-crm/issue/OBS-724) is the authoritative proposal. This branch defines and captures the three termination fields in tracing and exports them through `MastraStorageExporter` and `MastraPlatformExporter`. Native-column storage support and all query support belong to separate work. Earlier local proposals are historical context.

### Contract and scope

The shared [outcome contract](../../packages/core/src/observability/types/outcome.ts) defines `outcome`, nullable `stopReason`, and nullable, strongly typed `stopReasonContext`. Lifecycle options, exports, snapshots, and the shared exporter record contract carry these fields.

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

### Workflow scope

This change instruments live workflow spans and preserves outcome fields through the engines' existing span snapshot/rebuild paths. It does not add workflow-storage checkpoints, worker-replacement tracing recovery, cancellation handlers for abandoned spans, or terminal-event reconciliation. Those changes and their dedicated tests have been removed from this PR; the earlier implementation remains available in Git history.

Suspended and resumed executions retain separate outcomes where the existing engine supplies their span lifecycle boundaries. Worker disappearance alone does not establish an outcome. Cross-worker completion after caller loss and cancellation of orphaned spans remain outside this tracing/export change.

### Export boundary

`MastraStorageExporter` and `MastraPlatformExporter` use shared record builders that preserve `outcome`, `stopReason`, and `stopReasonContext`. Creates serialize absent values as null; updates omit absent fields and retain explicit nulls. Context remains a strongly typed, serializable object containing reason-specific facts and relevant agent signals.

The storage exporter passes these records to the configured storage domain. The Platform exporter serializes them in its HTTP payload. Backend native columns, migrations, read mappings, query filters, value discovery, and generated query API changes are intentionally excluded from this branch. Their implementation and deployment are coordinated separately; exporter support alone does not establish backend persistence.

### Validation and remaining work

Shared agent scenarios cover normal, durable, evented, filesystem-routed, and real Inngest execution. Local workflow tests cover ordinary outcomes, guardrails, cancellation, and suspension/resume. The Inngest workflow suite uses the real dev server and its existing durable operations. Exporter tests use real in-memory storage and a local HTTP server, asserting the three native fields, nested observer causes, and serialized signals.

Relevant suites include [agent outcomes](../../packages/core/src/loop/test-utils/aimock/scenarios/native-outcomes.scenario.test.ts), [observer causes](../../packages/core/src/loop/test-utils/aimock/scenarios/observer-outcomes.scenario.test.ts), [signal context](../../packages/core/src/loop/test-utils/aimock/scenarios/signal-outcomes.scenario.test.ts), [workflow tracing](src/workflow-cancel-tracing.test.ts), [Inngest workflow outcomes](../../workflows/inngest/src/__tests__/workflow-native-outcomes.test.ts), and [exporter payload agreement](src/exporters/span-previews.test.ts).

Backend native columns, migrations, queries, and Platform ingestion/storage deployment are separate work. Third-party exporter mappings, external-placeholder creation, and trace/thread representative selection also remain outside this change. Additional reason codes need review against the Linear proposal. This PR does not claim full OBS-724 completion or repair public workflow status/recovery behavior.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/observability/mastra/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
