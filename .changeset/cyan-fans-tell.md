---
'@mastra/observability': patch
---

Fixed workflow tool results showing only `[tool-result: workflow-<name>]` in the input of the next model step span. When an agent calls a workflow through `new Agent({ workflows })`, the step span now shows the workflow result the model received, so observability exporters such as Langfuse keep it in the traced conversation. What the model receives is unchanged. Needs the `@mastra/core` release from the same fix; with an older core the placeholder stays. Fixes #30219.
