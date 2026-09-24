---
'@mastra/schema-compat': patch
---

Fixed `jsonSchemaToZod` to emit discriminated-union property names as string literals. Previously, a JSON Schema whose `anyOf` branches shared a `const` property with a crafted name could run arbitrary code when the generated Zod source was evaluated, for example while validating dataset items.
