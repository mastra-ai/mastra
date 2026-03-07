---
'@mastra/server': patch
---

Fixed "Invalid query parameters" errors that occurred in projects using Zod v4 when filtering by date ranges, tags, or metadata. Complex query parameters (objects, arrays, records) are now correctly detected and parsed for both Zod v3 and v4.
