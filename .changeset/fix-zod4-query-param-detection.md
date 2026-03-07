---
'@mastra/server': patch
---

fix(server): fix complex query parameter parsing for Zod v4 projects

Projects using Zod v4 would get "Invalid query parameters" errors when using date-range filters, tag filters, or metadata filters in the Studio Observability UI and server API. Complex query parameters (objects, arrays, records) are now correctly detected and parsed regardless of whether the project uses Zod v3 or v4.
