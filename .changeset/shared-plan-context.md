---
'@mastra/factory': minor
---

Planning and Building on the Work board now run in one `work` session, so the builder keeps the plan's reasoning, branch and sandbox. When the planner moves the card to Building, the build prompt is queued onto its own run.

This replaces the fallback that let a build borrow the plan or triage session. Triage no longer hands its session to later phases. Runs and API calls that name the `plan` role still start Planning, and cards planned before this change keep using their `plan` session for the build.

`invokeSkill` decisions accept `startsAfterOwnMove: true` to start a run even when the agent of the same session moved the card. Custom board phases with a `runner.skill` set it when a card enters from another phase, so moving a card between phases that share a context now starts the next phase's skill.
