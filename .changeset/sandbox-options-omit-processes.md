---
'@mastra/core': patch
'@mastra/blaxel': patch
'@mastra/e2b': patch
'@mastra/daytona': patch
---

Remove internal `processes` field from sandbox provider options

The `processes` field is no longer exposed in constructor options for E2B, Daytona, and Blaxel sandbox providers. This field is managed internally and was not intended to be user-configurable.
