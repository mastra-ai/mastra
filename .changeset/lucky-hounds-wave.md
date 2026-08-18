---
'@mastra/server': patch
---

Removed the reshaping step the agent controller's SSE stream ran on every event. Controller events now serialize to JSON on their own, so the stream forwards them untouched and there is no second description of the payload to keep in step with `@mastra/core`.

Clients see the same fields as before. Error payloads may now carry a `cause`; stack traces are still left out.
