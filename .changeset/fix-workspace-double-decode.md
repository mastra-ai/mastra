---
'@mastra/server': patch
---

Preserve literal percent-encoded sequences in workspace filesystem paths. Read, write, create, and delete operations now target the exact requested file instead of decoding query and body values a second time. Closes #24620.
