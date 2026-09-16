---
'@mastra/core': patch
---

Removed the redundant direct Ajv dependency. Schema compatibility bundles its validator and standalone types without requiring a separate Ajv installation.
