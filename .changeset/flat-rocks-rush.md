---
'@mastra/schema-compat': patch
---

Fixed a crash when converting Zod v4 schemas containing `z.record(...)` through `applyCompatLayer` with any provider compat layer attached (e.g. `GoogleSchemaCompatLayer`, `OpenAISchemaCompatLayer`).

The record patch is now applied in `toStandardSchema` before the `StandardSchemaWithJSON` short-circuit, so it covers Zod >= 4.2 (which natively exposes `~standard.jsonSchema` and bypasses the Zod v4 adapter) as well as older Zod v4 versions that go through the adapter. Affects Zod 4.0.0–4.3.x; the underlying `z.record()` bug is fixed upstream in Zod 4.4.0.

Fixes [#17051](https://github.com/mastra-ai/mastra/issues/17051).
