---
'@mastra/server': patch
---

Fix skill reference endpoint returning 404 by prepending `references/` to the path passed to `getReference()`, aligning the HTTP handler with the skill-root-relative path contract introduced in #13363.
