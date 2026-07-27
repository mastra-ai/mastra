---
'@mastra/core': minor
---

Added tool definitions to MODEL_GENERATION span attributes. The tools made available to the model (name, description, and JSON-schema parameters) are now captured once per generation as the `tools` attribute, so observability exporters can surface which tool schemas the model ran with. Related: #20242
