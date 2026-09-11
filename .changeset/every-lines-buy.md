---
'@mastra/factory': patch
---

Fixed `git push` over HTTPS failing in Factory issue, Linear, and manual sandbox sessions. The Git credential helper is now installed for every session type, not only pull request sessions.
