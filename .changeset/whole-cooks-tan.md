---
'@mastra/core': patch
---

Fixed notification delivery policy so a `source` named after a JavaScript `Object.prototype` member (such as `constructor`, `toString`, or `hasOwnProperty`) no longer bypasses your configured `priorities` and `default`. Previously such a source resolved an inherited function and was delivered even when `default: 'discard'` was set. Source and priority lookups now only match keys you explicitly configured. Fixes #23694.
