# Fit Exploration 05

This exploration tests whether `Flow` can be a derived index built from Pulses plus exported relationships.

The pressure comes from the Definition experiment: runtime Pulses can avoid copying config, instructions, tool schemas, model settings, and content only if relationships can reconstruct what was active, ordered, contained, resumed, or inherited at a given point.

## What Changed Since Exploration 04

- Definitions now lean toward referenced artifacts/contracts plus ChangePulses for lifecycle, selection, and scoped applicability.
- `DefinitionPulse` is provisional, not a core family member.
- That result depends on relationship edges such as `uses_config_version`, `uses_tool_definition`, `enables_definition`, and `validated_against`.
- `Flow` currently leans derived read/query index, not exported Pulse-like envelope.
- The PR #20499 review comment provides a concrete warning against overloading one parent field with multiple meanings.

## Test Boundary

In scope:

- derived Flow reconstruction
- exported relationship records
- purpose-named relationship types
- containment, ordering, parent/child, and previous-flow relationships
- resume, subagent, and external-parent bridge relationships
- definition use and scoped applicability relationships
- content ownership and context reconstruction relationships
- minimal read indexes needed to make the graph usable

Out of scope:

- full storage schema design
- UI display design
- complete implementation details
- Agent Signals mapping, except where signal relationships resemble arrival/change edges
- Snapshot design, except as a failure mode if graph reconstruction is unbounded

## Inputs To Read

- `pulse/AGENTS.md`
- `pulse/README.md`
- `pulse/glossary.md`
- `pulse/experiment-backlog.md`
- `pulse/fit_exploration_procedure.md`
- `pulse/fit_exploration_04/05-learnings-summary.md`
- `pulse/fit_exploration_04/10-full-scenario.md`
- `pulse/fit_exploration_04/12-relationship-handoff.md`
- `pulse/fit_exploration_03/04-open-questions.md`
- `pulse/fit_exploration_03/07-export-family-comparison.md`
- relevant code audit files listed in `06-source-plan.md`
- relevant package-local `AGENTS.md` before source inspection

## Output Files

- `00-exploration-log.md`
- `01-shape-fit-rules.md`
- `02-family-fit-matrix.md`
- `03-worked-examples.md`
- `04-open-questions.md`
- `05-learnings-summary.md`
- `06-source-plan.md`
- `07-seed-scenarios.md`
- `08-source-notes.md`
- `09-candidate-relationship-model.md`
- `10-scenario-results.md`
- `11-adversarial-review.md`
- `12-decision-record.md`
- `13-end-to-end-graph.md`
