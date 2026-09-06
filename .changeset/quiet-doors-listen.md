---

'@mastra/schema-compat': patch
---

Fixed optional enum and const properties in OpenAI strict schemas so they accept null like every other optional property. Optional enum or const values no longer fail tool calls when the model sends null for the omitted value.
