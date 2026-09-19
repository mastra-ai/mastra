---
'@mastra/code-sdk': patch
---

Mastra Code no longer wires its own prefill error processor or a duplicate provider-history copy in its input lane. It inherits the prefill handler from `@mastra/core` and keeps only its own stream-retry policy.
