---
"@mastra/server": patch
---

Fix query parameter parsing for complex nested optional types

Fixes an issue where complex query parameters (like `startedAt` and `endedAt` date range filters) would fail with "Expected object, received string" errors when using the `listTraces` API.

The fix addresses two issues:
- Properly unwraps all layers of nested optional/nullable types (e.g., from `.partial()` on already-optional fields)
- Ensures compatibility with both zod v3 and v4
