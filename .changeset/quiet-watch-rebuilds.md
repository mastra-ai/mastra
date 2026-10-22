---
'@mastra/playground-ui': patch
---

Fixed Studio reloading the whole page after a shared component edit during development. Watch builds now write only the files whose content changed, so apps reading the watch output get one hot update per edit instead of about 1,800.
