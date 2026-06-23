# Pulse Fit Exploration

This folder explores how audited Mastra runtime events could fit into the Pulse shape.

This is not an implementation plan yet. It is a working notebook for testing whether the raw events from `pulse/code_audit/` can be represented as lean point-in-time observations without smuggling spans, logs, or metrics back in under new names.

## Inputs

- `pulse/README.md`: current Pulse concept and shape.
- `pulse/code_audit/11-pulse-applicability-review.md`: first filter for user-primitive applicability.
- `pulse/code_audit/*.md`: raw event inventory.

## Current Working Constraint

Initial Pulse scope should be limited to user primitive execution:

- agents
- workflows
- tools
- model calls inside primitives
- processors
- scorers/evals
- memory/state activity owned by a primitive
- harness/channel/A2A/code-mode activity that carries work into or out of those primitives

Skip initial Pulse emission for:

- admin/catalog/config APIs
- org/license/telemetry tasks
- observability navigation/query APIs
- storage adapter internals by themselves
- server/auth/session plumbing by itself

## Files

- `00-exploration-log.md`: chronological notes of what was tried.
- `01-shape-fit-rules.md`: rules for mapping an audited event into Pulse fields.
- `02-family-fit-matrix.md`: event-family classification and first-pass Pulse fit.
- `03-worked-examples.md`: concrete sample Pulses for representative events.
- `04-open-questions.md`: questions discovered during the fit pass.
- `05-learnings-summary.md`: reviewed takeaways and current shape corrections from this pass.
