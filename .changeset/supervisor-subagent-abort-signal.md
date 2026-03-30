---
'@mastra/core': patch
---

**Supervisor / sub-agent runs**: When a parent agent is stopped with `abortSignal` (for example from `AbortController` or an HTTP disconnect), that same signal is now passed into delegated sub-agent `generate`, `stream`, `resumeGenerate`, and `resumeStream` calls. Aborting the supervisor cancels nested work instead of leaving the sub-agent running.

Refs: https://github.com/mastra-ai/mastra/issues/14820
