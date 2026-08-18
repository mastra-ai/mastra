---
'@mastra/server': patch
---

Removed the reshaping step the agent controller's SSE stream ran on every event. Controller events now serialize to JSON on their own, so the stream forwards them untouched and there is no second description of the payload to keep in step with `@mastra/core`.

Display state arrives as before. Error payloads now carry the error's own JSON instead of a flattened `{ name, message }`: custom fields such as a status code, a `cause`, and a stack when the error has one — the same shape agent stream error chunks already use.
