# Pulse Fit Exploration 02

This exploration tests the expanded Pulse scope after the branch was rebased on main.

`fit_exploration_01` focused mostly on runtime execution events identified by the original code audit. This pass adds three areas that were not covered well enough:

- configuration provenance from Agent Builder, Agent CMS, and editor storage namespaces
- definition-once/reference-many capture for tools and other runtime definitions
- thread-to-thread flow links for conversational agents

## Inputs

- `pulse/README.md`
- `pulse/scope-expansion-after-01.md`
- `pulse/fit_exploration_procedure.md`
- `pulse/fit_exploration_01/05-learnings-summary.md`
- `pulse/code_audit/*.md`
- refreshed source scan after rebase:
  - `packages/core/src`
  - `packages/core/agent-builder`
  - `packages/agent-builder/src`
  - `packages/editor/src`

## Current Test Boundary

In scope:

- runtime Pulse shape changes from exploration 01
- config mutation Pulses for stored agents and builder-authored agent config
- config revision/version references from runtime flows
- tool definition capture and runtime references
- thread grouping and flow ordering across agent turns
- current chunk/span behavior as a candidate Pulse stream model

Out of scope:

- implementation API
- storage table design
- exporter compatibility
- migration from current spans
- UI display design
- generic storage adapter CRUD unless it explains runtime behavior or config provenance

## Files

- `00-exploration-log.md`: chronological notes of source scans and fit attempts.
- `01-shape-fit-rules.md`: candidate shape and rules tested in this pass.
- `02-family-fit-matrix.md`: event-family classification for runtime, config, definitions, and threads.
- `03-worked-examples.md`: concrete Pulse and Flow examples.
- `04-open-questions.md`: unresolved questions from this pass.
- `05-learnings-summary.md`: final learnings from this pass.
- `06-source-refresh-notes.md`: source findings from the rebased tree.
- `07-config-provenance-fit.md`: focused config mutation fit notes.
- `08-definition-reference-fit.md`: focused definition-once/reference-many fit notes.
- `09-thread-flow-fit.md`: focused thread/flow relationship notes.
