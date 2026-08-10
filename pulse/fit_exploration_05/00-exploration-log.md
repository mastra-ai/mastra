# Exploration Log

## 2026-08-10 - Setup

Read:

- `pulse/AGENTS.md`
- `pulse/fit_exploration_procedure.md`
- `pulse/experiment-backlog.md`
- `pulse/fit_exploration_04/12-relationship-handoff.md`
- `pulse/fit_exploration_04/README.md`
- `pulse/fit_exploration_04/01-shape-fit-rules.md`

Assumptions:

- This pass should test Flow as a derived read/query index, not an exported event envelope.
- Relationship records may be exported append-only records even if Flow is not.
- Purpose-named relationship edges should be tested against the overloaded-parent-field failure described in PR #20499.
- Definition refs from Exploration 04 are a primary stress case.

Prepared:

- canonical exploration files
- source inspection plan
- initial shape rules and fit matrix scaffold
- seed scenarios for the next pass

Risk noticed:

- If every query needs expensive graph replay from the origin Pulse, derived Flow may be theoretically clean but operationally weak.
- If relationship types become too broad, they recreate overloaded `parentSpanId` under a new name.
- If relationship types become too narrow, readers need bespoke logic for every surface.

## 2026-08-10 - Source Pass 1

Read:

- `packages/core/AGENTS.md`
- `packages/core/src/observability/types/tracing.ts`
- `packages/core/src/storage/domains/observability/tracing.ts`
- `packages/core/src/storage/domains/observability/record-builders.ts`
- `packages/playground/src/domains/experiments/utils/format-trace-spans.ts`
- `packages/core/src/agent/agent.ts`
- `packages/core/src/agent/durable/durable-agent.ts`
- `packages/core/src/agent/__tests__/resume-span-tracing.test.ts`
- `packages/core/src/loop/workflows/agentic-execution/provider-tool-spans.ts`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`
- `packages/core/src/agent/message-list/message-list.ts`
- `packages/core/src/agent/message-list/tests/message-list-ordering.test.ts`
- `packages/core/src/loop/workflows/agentic-execution/build-messages-from-chunks.ts`
- `packages/core/src/storage/domains/memory/base.ts`
- `packages/core/src/storage/domains/memory/inmemory.ts`
- `packages/core/src/agent/subagent.ts`
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`
- workflow suspend/resume source listed in `08-source-notes.md`

Findings:

- Current trace UI reconstructs hierarchy from flat span records using `parentSpanId`, but Pulse has more relationship meanings than one parent field can carry.
- Resume is lineage, not ordinary parentage. Existing code already stores `resumedFromSpanId` separately from parent span mechanics.
- Provider tool parentage can be discovered late; relationships need append-after-endpoints semantics.
- Message/context order is not safely timestamp-only; MessageList uses timestamp bumping to preserve insertion order.
- Subagent delegation needs edges for delegation and inner/outer run identity, not just containment.

Prepared:

- `08-source-notes.md`
- `09-candidate-relationship-model.md`
- `10-scenario-results.md`

## 2026-08-10 - Adversarial Review

Tried:

1. Treat materialized Flow as a read index, not an export.
   - Result: works if lifecycle/status/config/context fields remain derived from Pulses and relationships.
   - Concern: a stored Flow row can quietly become authoritative if emitters write to it directly.
2. Challenge purpose-named relationship vocabulary.
   - Result: purpose names are useful when reader behavior changes, such as `parent_of` versus `resume_of`.
   - Concern: overly specific edges like `provider_tool_result_of` may be better as a generic edge plus attributes.
3. Challenge direct `uses_*` edges.
   - Result: direct edges are useful for explicit acts; inherited state should be materialized from scoped ChangePulses.

Prepared:

- `11-adversarial-review.md`

## 2026-08-10 - Closing Pass

Tried:

1. Decide Flow identity.
   - Result: allow `flow` endpoint ids as derived index identities.
   - Constraint: Flow must not gain Pulse/event lifecycle semantics.
2. Split relationship names into core and candidate sets.
   - Result: core vocabulary is small enough to support reconstruction without one overloaded parent field.
   - Concern: candidate relationships should only be promoted when reader behavior requires them.
3. Build one end-to-end graph.
   - Result: the graph reconstructs Flow, thread order, active definitions, content state, external bridge, and resume without a Flow envelope or Snapshot.
   - Concern: `next_pulse` should be selective; otherwise the graph gets noisy.

Prepared:

- `12-decision-record.md`
- `13-end-to-end-graph.md`
