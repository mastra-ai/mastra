---
'@mastra/schema-compat': patch
---

Fixed JSON Schema adapter declarations to use bundled Ajv types, so consumers do not need a separate Ajv installation. Ajv remains bundled as a development dependency.
