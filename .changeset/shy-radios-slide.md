---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed 'Type instantiation is excessively deep' (TS2589) errors that occurred when defining workflows with Zod schemas. Workflow and step type inference is now significantly faster and no longer causes TypeScript to crash or report depth errors.
