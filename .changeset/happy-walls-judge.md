---
'@mastra/core': patch
---

Fixed `stream.text` so it resolves only to the final step's answer and excludes interim commentary between tool calls when no memory or output processors are configured. All text still streams in full through `fullStream`, and per-step text remains available on `steps`. Fixes [#17986](https://github.com/mastra-ai/mastra/issues/17986).
