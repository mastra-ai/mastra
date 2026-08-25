---
'@mastra/playground-ui': patch
---

Fixed popups, tooltips, and menus occasionally stretching the page and showing a second pair of scrollbars. Floating elements now use fixed positioning, so a popup that closes or outlives a window resize can no longer grow the document behind it.
