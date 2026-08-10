# Fit Exploration 04

This exploration tests how Pulse should represent definitions.

The pressure comes from prior open questions around instructions, settings, configs, tool schemas, model settings, and other reusable bodies that runtime Pulses should reference without copying into every observation.

## What Changed Since Exploration 03

- `Change` and `Snapshot` should be tested as special Pulse types before treating them as sibling export artifacts.
- Snapshots should be avoided unless reconstruction forces them.
- `Flow` currently leans derived read/query index, not exported envelope.
- Content bodies currently lean toward being owned by the Pulse that introduces them into execution.
- Definitions remain unresolved and need direct testing.
- Definitions may be temporary or permanent by scope of effect, not only by storage durability.

## Test Boundary

In scope:

- durable agent config definitions
- instruction revisions
- tool definitions and schemas
- model settings revisions
- request context schemas
- runtime overrides
- generated instructions
- run-local tool schemas
- next-step tool set changes
- one-call model settings
- runtime references from Pulses to definitions

Out of scope:

- implementation design
- storage schema design
- UI presentation
- complete flow/relationship graph design
- Agent Signals mapping
- generic admin/query/storage plumbing that does not materially explain runtime behavior

## Inputs To Read

- `pulse/AGENTS.md`
- `pulse/README.md`
- `pulse/glossary.md`
- `pulse/experiment-backlog.md`
- `pulse/fit_exploration_procedure.md`
- `pulse/fit_exploration_03/05-learnings-summary.md`
- `pulse/fit_exploration_03/07-export-family-comparison.md`
- `pulse/code_audit/11-pulse-applicability-review.md`
- `pulse/code_audit/12-harness-agent-config-pulse-candidates.md`
- relevant package-local `AGENTS.md` before source inspection
- source files listed in `06-source-plan.md`

## Output Files

- `00-exploration-log.md`
- `01-shape-fit-rules.md`
- `02-family-fit-matrix.md`
- `03-worked-examples.md`
- `04-open-questions.md`
- `05-learnings-summary.md`
- `06-source-plan.md`
- `07-source-notes.md`
- `08-definition-edge-cases.md`
- `09-candidate-model.md`
- `10-full-scenario.md`
- `11-adversarial-review.md`
- `12-relationship-handoff.md`
