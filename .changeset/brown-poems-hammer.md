---
'@mastra/voice-google-gemini-live': patch
---

Fixed tool parameter schemas for all Zod types by replacing the hand-rolled converter with the canonical zodToJsonSchema from @mastra/schema-compat. Previously, types like z.union, z.discriminatedUnion, z.literal, z.nullable, z.record, z.tuple, and z.default all fell through to an empty object schema, so Gemini Live received no type information and returned empty tool arguments.
