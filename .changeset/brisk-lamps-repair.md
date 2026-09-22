---
'@internal/playground': patch
---

Fixed status colours that silently rendered as plain text.

Warning and success messages in the CSV import flow, the impersonation banner, the agent CMS reference block and the browser view live dot named colours the theme never defined — `text-warning`, `bg-success`, `text-info1`, `bg-primary` and friends — so they compiled to nothing and painted at the inherited body colour. A warning did not look like a warning, the live dot was invisible, and the three dataset progress bars read as empty at every value.

They now use the status tokens: boxed summaries take the notice wash and its paired ink, dots and fills take the standalone status ink, and a sentence keeps the hue on its icon so the words stay legible in light mode. Messages with no icon take `--error`, the one status ink that clears 4.5:1 in both themes. Five leftovers from retired ramps (`text-text2`, `text-text3`, `text-icon-3`, `text-mastra-el-6`, `text-gray`) move to the semantic inks.
