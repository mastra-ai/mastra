---
'@mastra/code-sdk': minor
'mastracode': patch
---

Added a `schedules` module with a process-local `ThreadScheduler` that fires recurring prompts into a thread on wall-clock boundaries, plus argument parsing for prompt or file sources and fire-time prompt assembly (scripts run via `execFile` on the literal path; prompt files are re-read each fire). The Mastra Code controller exposes the scheduler as `threadScheduler`; schedules are never written to storage, so processes sharing a database don't fire each other's schedules.
