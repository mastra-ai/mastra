---
'@mastra/core': patch
---

Fixed dynamic workspace resolution so workspace factories receive the full request context. Workspace factories can now safely read session state with getState(), and abort stream tests now better match real async streaming behavior.
