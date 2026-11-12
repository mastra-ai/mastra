---
'@mastra/core': patch
---

Fixed background task timeouts and failure callbacks, and improved the messages agents see for background work.

- A background task `timeoutMs` of `0` now means no timeout. Before, the task timed out right away.
- `onTaskFailed` and per-tool `onFailed` callbacks now fire when recovery fails a task whose worker stopped before it finished. After a restart only the global `onTaskFailed` fires, because per-tool callbacks lived in the old process.
- The placeholder result for a background tool call now tells the model not to poll or wait for the task.
- An `AgentController` subagent that reaches its step limit while still calling tools now says so. Its result starts with `[Stopped at the 50-step limit before a final answer]` (with the actual limit), and any text it wrote along the way follows under `Partial output:`. Before, the parent got that narration as if it were the answer, or an empty result.
