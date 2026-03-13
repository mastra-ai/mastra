---
'@mastra/schema-compat': patch
---

Fixed false `z.toJSONSchema is not available` errors for compatible Zod versions.

**What changed**
- Improved Zod schema conversion detection so JSON Schema generation works more reliably across different runtime setups.
