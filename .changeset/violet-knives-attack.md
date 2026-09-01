---
'@mastra/observability': patch
---

Fixed request context values configured via requestContextKeys being silently dropped when a span's own metadata names the same key with an undefined value. A threadId set on a RequestContext now reaches exported spans even when the agent has no memory configured, so exporters like Arize can group traces into sessions again. Fixes [#22597](https://github.com/mastra-ai/mastra/issues/22597).
