---
'@mastra/playground-ui': patch
---

Fixed the ClampedText read-more button to announce its expanded state to screen readers, and fixed clamp measurement so font-load re-measure and effect cleanup still run in browsers without ResizeObserver.
