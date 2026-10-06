---
'@mastra/connect': minor
---

Connect tool calls now show up in traces. When observability is enabled, every platform API call and proxied vendor call appears as a child span under the tool call span, recording the method, a safe route template, connection id, and response status. Spans never include query strings, headers, bodies, or vendor path segments; apps without observability configured are unaffected.
