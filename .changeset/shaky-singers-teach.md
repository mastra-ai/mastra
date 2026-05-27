---
'@mastra/voice-google-gemini-live': patch
---

Tools registered via `voice.addTools(...)` with rich Zod schemas now reach Gemini Live with a faithful schema. The package routes Zod through `@mastra/schema-compat`'s `applyCompatLayer` + `GoogleSchemaCompatLayer` — the in-repo Google pipeline — so the tool parameters land in the OpenAPI 3.0 shape Gemini Live's setup validator accepts.

Fixes #17020.
