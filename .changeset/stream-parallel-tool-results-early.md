---
'@mastra/core': patch
---

Fixed parallel tool results waiting for the slowest tool in the step. When an agent calls several tools at once, each `tool-result` chunk now streams as soon as that tool finishes, so a fast tool's result shows up right away instead of after the slowest call. Step results, `toolResults`, the messages sent back to the model and saved memory still list results in the order the model called the tools. Fixes [#21902](https://github.com/mastra-ai/mastra/issues/21902).
