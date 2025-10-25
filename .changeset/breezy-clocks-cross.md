---
'@mastra/schema-compat': patch
---

Fix Zod v4 toJSONSchema bug with z.record() schemas by adding fallback to v3 converter

Zod v4 `toJSONSchema()` method has a bug when processing schemas containing `z.record()` fields, throwing "Cannot read properties of undefined (reading '_zod')" during recursive schema processing. This fix adds a try-catch wrapper that falls back to the v3 zod-to-json if Zod v4's converter fails.
