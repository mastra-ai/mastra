---
'@mastra/core': patch
---

Fixed `structuredOutput.model` to inherit read-only thread memory when the parent agent has memory configured, improving separate-model structured output accuracy without polluting the main thread.
