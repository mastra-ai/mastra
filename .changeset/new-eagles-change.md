---
'@mastra/core': patch
---

Fix image handling for Google Gemini and other providers (fixes #7362)

- Add utility functions for consistent image data conversion
- Properly handle different image data types (string, URL, Uint8Array, ArrayBuffer)
- Remove workaround for stringified byte arrays
- Use url field with data URIs for AI SDK V5 compatibility
