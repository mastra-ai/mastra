---
'@mastra/playground-ui': patch
---

Improved `ScrollArea` to use Base UI internally while keeping its existing public API. No code changes are required for existing `ScrollArea` usage — `showMask`, `maxHeight`, `viewPortClassName`, `autoScroll`, and `orientation` all behave as before.
