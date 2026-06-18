---
'@mastra/playground-ui': patch
---

Fixed copy button silently failing in browsers with strict clipboard permissions (Arc, Firefox). Adds a document.execCommand fallback so copy works without needing the Clipboard API permission.
