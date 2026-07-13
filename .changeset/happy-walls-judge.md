---
'@mastra/core': patch
---

Fixed `stream.text` including the agent's interim commentary between tool calls when no memory or output processors are configured. When a model narrates its progress across multiple steps (for example while recovering from failed tool calls), `stream.text` now resolves to only the final step's answer, matching the existing behavior when memory is configured. All text still streams in full through `fullStream`, and per-step text remains available on `steps`. Fixes [#17986](https://github.com/mastra-ai/mastra/issues/17986).
