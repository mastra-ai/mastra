---
"@mastra/core": patch
---

Added support for plain JSON Schema objects in client-side tools, fixing OpenAI "Invalid schema" errors.

**What changed:**
- `CoreToolBuilder` now detects and handles plain JSON Schema objects directly without unnecessary Zod conversion
- Added debug logging in `listClientTools` to help trace schema transformations
- Plain JSON Schemas from client-side tools are wrapped directly in AI SDK Schema format

**Impact:** Client-side tools can now use plain JSON Schema objects alongside Zod schemas without encountering serialization errors.

Fixes #11668
