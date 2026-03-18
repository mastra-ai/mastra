---
"@mastra/schema-compat": patch
---

Fixed crash when serializing tools with Zod v3 schemas using the draft-2020-12 JSON Schema target. Previously threw "Unsupported JSON Schema target: draft-2020-12" — now falls back to draft-07 output, matching the behavior of the Zod v4 adapter.
