---
'@mastra/core': patch
---

Fix durable agents dropping `writer.custom()` / `writer.write()` emissions from tools. The durable tool-call step now provides a `writer` (`ToolStream`) in the tool execution context, so tools resolved from the Mastra registry on cross-process runs (e.g. an `@mastra/inngest` worker) receive a working writer instead of `undefined`. Fixes #24196.
