---
'@mastra/modal': patch
---

Fixed `ModalSandbox.clone()` ignoring the `workingDirectory` override, so clones now use the requested directory instead of the template's.
