---
'@mastra/connect': minor
---

Added observability for outbound Connect HTTP calls. When tracing is enabled, every Mastra Platform API call and every vendor call routed through the connection proxy now appears as a child span under the active span (e.g. the tool call span), with method, normalized path, connection id, and response status — so a failing provider tool call can be traced end to end inside the agent trace. Spans never record query strings, headers, or bodies, and apps without observability configured are unaffected.
