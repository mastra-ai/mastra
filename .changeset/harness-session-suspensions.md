---
'@mastra/core': patch
---

Move the Harness's parked tool suspensions onto the Session as `session.suspensions` (a new `SessionSuspensions` class).

`SessionSuspensions` owns the `toolCallId → { runId, toolName }` resume map — the data the Harness reads to resume a tool paused via the native tool-suspension primitive (`ask_user` / `request_access` / `submit_plan`). It exposes `register`, `get`, `has`, `delete`, `clear`, `hasPending`, and `resolveToolCallId` (explicit-vs-sole selection). The Harness `pendingSuspensions` field and its `resolvePendingSuspensionToolCallId` helper are removed; the richer per-suspension UI snapshot stays on `HarnessDisplayState.pendingSuspensions`.

With the resume data session-owned, `Session.abortRun()` now also drops the parked suspensions, so `Harness.abort()` shrinks to clearing its display-state mirror and delegating to `session.abortRun()`. `Harness.abort()` and `Harness.hasPendingSuspensions()` keep their behavior; the latter now reads `session.suspensions.hasPending()`.
