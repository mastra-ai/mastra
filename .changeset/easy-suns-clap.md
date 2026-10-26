---
'@mastra/langsmith': patch
---

Fixed multi-turn conversations not showing up as LangSmith Threads. The exporter now maps the Mastra memory thread (`threadId`) to LangSmith's `session_id` on every run of the trace, so turns on the same thread group together without extra setup. A plain `sessionId` in span metadata, or an explicit `withLangsmithMetadata({ sessionId })`, still takes precedence.
