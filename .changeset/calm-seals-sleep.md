---
'@mastra/core': patch
---

Fixed output-stream processing for durable tool results after a restart or cleanup, including Inngest resumes. Restored processors receive the request context, and concurrent cold calls share the published processor pipeline and state. When the agent resolves but its processor pipeline is missing, processor reconstruction or cold-worker dependency-resolution failures (tools, memory, and workspace) stop the step instead of exposing unprocessed output. Unregistered agents, persistence-only callers, and complete live pipelines retain their dependency-resolution fallback. Fixes #26148.
