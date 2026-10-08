---
'@mastra/schema-compat': patch
---

Fixed `jsonSchemaToZod` so generated validators cannot run code hidden in a JSON Schema property name. Previously, a schema whose `anyOf` branches shared a `const` property with a crafted name could run arbitrary code when the validator was built, for example while validating dataset items.
