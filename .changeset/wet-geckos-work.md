---
'@mastra/core': patch
---

Fixed background tasks with `timeoutMs: 0` being stopped right away as timed out. A timeout of `0` now means the task has no timeout, whether it is set on the tool, the agent, or the background task manager's `defaultTimeoutMs`.

A background task whose tool throws its own `AbortError` is now reported as failed with the tool's error, and retried if retries are configured, instead of being marked as timed out.
