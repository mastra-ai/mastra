---
'@mastra/playground-ui': patch
---

Migrated ScrollArea from Radix UI to Base UI primitives. The component's public API is preserved, including showMask, maxHeight, viewPortClassName, autoScroll, and orientation. Internally, the manual scroll-overflow attribute hook was removed since Base UI exposes the same data-overflow-y-start/end and data-overflow-x-start/end attributes natively on the viewport. Scrollbar visibility now relies on Base UI's data-hovering and data-scrolling attributes.
