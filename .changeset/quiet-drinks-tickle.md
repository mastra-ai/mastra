---
'@mastra/memory': patch
---

Fixed observational memory removing tool-call messages while a separate message still carried the matching tool result, which broke client-side tools when observational memory was enabled.

See https://github.com/mastra-ai/mastra/issues/15244.
