# Mastra Code test recovery tracker

This tracker is the progress source of truth for `/goal/recover-mc-tests`.

## How to use

- Initialize or refresh rows from `.plan/mastracode-testing-recovery/features/README.md`.
- Include every feature page whose feature-map test status is `Missing` or `Partial`, plus any `High` risk page unless it is already validated.
- Keep one row per feature card unless tightly related cards are intentionally handled as one feature cluster.
- Preserve evidence when refreshing rows.
- A feature is not finished until status is `validated` and verification evidence is recorded.

## Status legend

- `pending` — not started.
- `in-progress` — currently being worked.
- `needs-follow-up` — attempted but more work is required.
- `blocked` — cannot proceed without external input or missing infrastructure.
- `deferred-needs-review` — intentionally deferred with rationale for the goal judge/user to review.
- `validated` — contracts are covered or explicitly deferred, verification passed, evidence recorded, and changes committed.

## Tracker

| Feature card | Risk | Feature-map tests | Required contract categories | Recovery status | New/updated tests | Verification evidence | Break-validation evidence | Commit(s) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| _Initialize from `features/README.md` before first recovery run._ | — | — | — | pending | — | — | — | — | — |
