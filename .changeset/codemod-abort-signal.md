---
'@mastra/codemod': patch
---

Fixed the `v1/agent-abort-signal` codemod creating a duplicate `abortSignal` key when the call already had one at the top level. It now leaves those calls unchanged and asks you to resolve them manually.
