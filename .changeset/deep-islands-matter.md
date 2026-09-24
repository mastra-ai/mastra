---
'@mastra/playground-ui': patch
---

Fixed `PageLayout` with `variant="narrow"` overflowing the page when content is wider than the column, such as a list with a long unbroken name. The column now stays at its width and wide content scrolls inside its own container.
