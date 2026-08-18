---
'@mastra/core': patch
---

Fixed tool search and skill search losing loaded state for HTTP requests that pass a thread via memory options. Processors now resolve the thread ID from the memory request context, and single-name load_tool results are recognized when reconstructing loaded tools from conversation messages with storage: 'context'. Fixes #21508
