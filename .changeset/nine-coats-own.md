---
'@mastra/voice-google-gemini-live': patch
---

Fixed Gemini Live tool registration failing with `1007 Unknown name` errors for tools using discriminated unions, literals, and nullable types. The `sanitizeToolParameters` method now rewrites `oneOf` → `anyOf`, `const` → `enum`, and collapses nullable `anyOf` patterns into OpenAPI 3.0-compatible `type` + `nullable: true` form. Fixes #17020.
