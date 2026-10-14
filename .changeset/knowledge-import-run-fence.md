---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed a recovered Knowledge import worker being able to write after its run was taken over. Every node, record and skip write linked to an import run now checks, inside the same storage transaction, that the run is still running, and is rejected otherwise. Recovery always replaces a stalled run under a new id, so the replacement run applies its changes exactly once.
