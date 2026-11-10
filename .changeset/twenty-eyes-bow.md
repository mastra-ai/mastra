---
'@mastra/playground-ui': patch
---

Improved resize performance on pages with many metrics charts. Charts that are scrolled out of view are no longer redrawn when their container resizes; they redraw once they scroll back into view, so opening a side panel no longer freezes the page.
