---
'@mastra/schema-compat': patch
---

Fixed OpenAI tools failing silently when they have optional number parameters with a `format`, such as `pageSize: { type: "integer", format: "int32" }`. These tools now return responses as expected.
