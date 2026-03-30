---
'@mastra/core': patch
---

Fixed agent run traces not appearing in Datadog and other observability backends when LLM calls fail. Previously, an API error during streaming would leave the root AGENT_RUN span open indefinitely, causing the entire trace tree to be silently dropped by exporters that wait for the root span to close. Failed agent runs now correctly end the span with error information, making failures visible in your observability dashboard.
