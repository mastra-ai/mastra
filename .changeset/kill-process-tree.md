---
'@mastra/platform-workspace': patch
'@mastra/e2b': patch
---

Fixed killing a background process leaving the processes it started running. Killing `npm run dev` stopped npm but not the dev server it launched, so the server kept serving and held its port. `kill()` now stops everything the process started too.
