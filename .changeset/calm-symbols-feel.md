---
'@mastra/memory': patch
---

Improved code organization in Observational Memory by extracting standalone utilities into dedicated modules for better maintainability.

- Extracted date/time utility functions into `date-utils.ts` with 49 unit tests
- Extracted process-level operation registry into `operation-registry.ts` with 7 unit tests
