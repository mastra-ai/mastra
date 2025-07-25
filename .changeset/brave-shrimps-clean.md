---
'@mastra/core': patch
---

Move createMockModel to test scope. This prevents test dependencies from leaking into production code.
