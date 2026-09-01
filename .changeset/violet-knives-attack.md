---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed span metadata values being silently erased by keys whose value is undefined. Values extracted via requestContextKeys (for example a threadId set on a RequestContext) now reach exported spans even when the agent has no memory configured, so exporters like Arize can group traces into sessions again. Keys passed in tracingOptions.metadata with undefined values no longer remove values the span already has; keys with real values still take precedence. Fixes [#22597](https://github.com/mastra-ai/mastra/issues/22597).
