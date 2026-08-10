# Source Notes

## Tracing Storage And UI

Read:

- `packages/core/src/observability/types/tracing.ts`
- `packages/core/src/storage/domains/observability/tracing.ts`
- `packages/core/src/storage/domains/observability/record-builders.ts`
- `packages/playground/src/domains/experiments/utils/format-trace-spans.ts`
- `packages/core/src/storage/domains/observability/tracing.test.ts`

Findings:

- Current span storage has `traceId`, `spanId`, and one `parentSpanId`.
- Trace UI builds a hierarchy by mapping `parentSpanId` to children, then sorting siblings by `startedAt`.
- `extractBranchSpans()` already needs cycle protection and keeps the anchor first even when descendants have earlier `startedAt`.
- Lightweight trace reads project only timeline fields and avoid full `input`, `output`, `attributes`, `tags`, and `links`.

Implication:

- A derived Flow index is plausible because current trace UI already reconstructs from flat records.
- A single parent field is too weak for Pulse because it cannot distinguish containment, execution parentage, external parentage, resume lineage, delegation, and ordering.
- Pulse should preserve the lightweight read pattern: graph structure can be materialized separately from heavy Pulse payloads.

## Resume Tracing

Read:

- `packages/core/src/agent/agent.ts`
- `packages/core/src/agent/durable/durable-agent.ts`
- `packages/core/src/agent/__tests__/resume-span-tracing.test.ts`

Findings:

- Non-durable resume opens a new `AGENT_RUN` span named with `(resumed)`.
- It uses the original trace id when available.
- It sets `parentSpanId` from the persisted suspended span unless caller-provided tracing options override it.
- It records `resumed: true` and `resumedFromSpanId` in metadata.
- Durable resume similarly opens fresh resume spans and stores `resumedFromSpanId` metadata.
- Caller-provided `tracingOptions` can intentionally override persisted trace linkage.

Implication:

- Resume is not ordinary parentage. It is lineage from a suspended segment to a resumed segment.
- Pulse should model this as `resume_of`, not as `parent_of`.
- Caller-provided external/cross-trace parentage should be represented separately from resume lineage.

## Provider And Client Tool Span Parentage

Read:

- `packages/core/src/loop/workflows/agentic-execution/provider-tool-spans.ts`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`

Findings:

- Provider-executed tool calls are stashed at call time.
- The provider tool span is created only when the result arrives, because only then can it parent under the model step that delivered the result.
- If the result never arrives, a fallback parent span anchors the pending call.
- Client tool spans are created at call time so an observability carrier can be injected into the outgoing tool-call payload.
- Client tool spans anchor to `AGENT_RUN`, not the model step, because the client tool runs outside the step lifecycle.

Implication:

- Relationship records need to be appendable after both endpoints exist.
- Parentage can be discovered late or differ by execution mode.
- `parent_of` is not enough; Pulse likely needs edges such as `provider_tool_result_of`, `client_tool_bridge`, or at least tool-call/result relationships separate from execution containment.

## Message And Content Ordering

Read:

- `packages/core/src/agent/message-list/message-list.ts`
- `packages/core/src/agent/message-list/conversion/input-converter.ts`
- `packages/core/src/agent/message-list/tests/message-list-ordering.test.ts`
- `packages/core/src/agent/__tests__/stream.e2e.test.ts`
- `packages/core/src/storage/domains/memory/base.ts`
- `packages/core/src/storage/domains/memory/inmemory.ts`
- `packages/core/src/loop/workflows/agentic-execution/build-messages-from-chunks.ts`

Findings:

- `MessageList` sorts messages by `createdAt`.
- When incoming messages lack timestamps or would collide, `generateCreatedAt()` advances by 1ms to preserve input order.
- Tests explicitly cover preserving order when messages share identical timestamps.
- Message history recall often fetches DESC and reverses into chronological order.
- Stream chunk conversion preserves arrival order by pushing parts on first delta.
- Stored message rows do not carry a trace id column; assistant message metadata stores trace id as a correlation workaround.

Implication:

- Timestamp-only ordering is not a strong enough graph primitive.
- Pulse should test explicit content/order relationships or sequence metadata for context reconstruction.
- Content-bearing Pulses can own introduced content, but readers need an order relation such as `next_context_item` or scoped sequence numbers.

## Subagent Delegation

Read:

- `packages/core/src/agent/agent.ts`
- `packages/core/src/agent/subagent.ts`
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`
- `packages/core/src/loop/shared/auto-resume-system-message.ts`

Findings:

- Subagents are exposed as `agent-*` tools.
- Delegation context records parent agent id/name, tool call id, parent run/thread/resource, and subagent thread/resource.
- Subagent executions may get their own memory thread/resource or injected supervisor memory.
- Suspended delegated runs preserve an inner `delegatedRunId`; public resume still targets the outer run id.
- Auto-resume surfaces `delegatedRunId` as the inner run id for the model-facing resume prompt.

Implication:

- Subagent delegation is not just parent/child containment.
- Pulse should test `delegates_to` / `subagent_of` edges separately from `parent_of`.
- Suspended delegated tools need both outer-run and inner-run relationships.

## Workflow Suspend/Resume

Read:

- `packages/core/src/workflows/handlers/step.ts`
- `packages/core/src/workflows/handlers/entry.ts`
- `packages/core/src/workflows/evented/workflow.ts`
- `workflows/inngest/src/run.ts`
- `workflows/inngest/src/execution-engine.ts`

Findings:

- Workflow snapshots store `suspendedPaths`, `resumeLabels`, status, context, and request context.
- Resume chooses a suspended step from explicit step, label, or suspended paths.
- Step results can carry `resumePayload`, `resumedAt`, and suspend payload metadata.
- Inngest workflow execution separately tracks trace ids and parent span ids for workflow and step spans.
- Snapshot writes are operational state, not observability facts by themselves.

Implication:

- `resume_of` edges need enough target detail to identify suspended step/path, not only run id.
- Operational snapshots should not force Pulse Snapshot back into the export family.
- A derived Flow index may materialize resume state without exporting snapshot payloads.

## Prior Pulse Audit Alignment

Read:

- `pulse/code_audit/11-pulse-applicability-review.md`
- `pulse/code_audit/12-harness-agent-config-pulse-candidates.md`
- `pulse/fit_exploration_03/08-message-context-fit.md`
- `pulse/fit_exploration_03/10-harness-v1-fit.md`

Findings:

- Prior harness notes already model suspension as Pulse + Change + `Relationship(resume_of)`.
- Prior subagent notes already prefer explicit parent/subagent relationships instead of separate unlinked roots.
- Prior message-context notes already reject growing `message_update` snapshots and prefer content/chunk Pulses plus context Changes.
- Config provenance notes already need runtime `uses_config_version`, `uses_tool_definition`, and `uses_instruction_version` relationships.

Implication:

- Exploration 05 is consistent with the earlier audits.
- The new contribution is tightening Flow into a derived/materialized index and making relationship families explicit.
