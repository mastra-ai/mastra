---
'@mastra/playground-ui': patch
---

Fixed code blocks stretching the page. A fenced code block inside markdown reported its longest line as a width requirement, so a long command pushed the whole layout wider than the window instead of scrolling inside the block. Code blocks now stay within the width they are given and scroll horizontally on their own.
