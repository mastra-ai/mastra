# Objectives

## Source Preservation

- Keep `../HARNESS_V1_SPEC.md` as the canonical document.
- Keep `sections/` as a lossless split of the canonical document.
- Let git track changes to the canonical spec and split files.

## CLI Council Accuracy

- Require each council member to cite exact split files before recommending a change.
- Prefer justified diffs over broad commentary.
- Treat unsupported claims as unresolved until the orchestrator verifies them against the spec.
- Keep raw council output transient unless the user asks to preserve it.

## Harness Fit

- Preserve the Harness/Session separation: Harness as stateless infrastructure, Session as per-conversation runtime.
- Preserve tenant isolation through `resourceId` checks and non-leaking not-found behavior.
- Preserve the concurrency model: `message` drains through signals, `queue` remains durable FIFO, and sync structured output stays fail-fast.
- Preserve persistence, workspace ownership, event ordering, subagent guarantees, and remote-safe API boundaries unless the canonical spec is intentionally revised.

## Diff Discipline

- One orchestrator writes the final change.
- Every accepted change should map to a source section and an objective.
- Edit the canonical spec before regenerating split files.
- Rejected alternatives do not need a persistent artifact unless the user asks for one.

## Iteration Discipline

- Re-run council only for material scope changes, high-risk conflicts, or contract-level uncertainty.
- Let the orchestrator handle small verified follow-ups directly.
- Prefer narrow checks over repo-wide checks.
