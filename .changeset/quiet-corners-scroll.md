---
'@mastra/playground-ui': patch
---

Fixed scrollbars being cut off by the rounded corners of filter dropdowns (`FilterBar`, `PropertyFilter`), the model picker and score reason cards. They now use the same overlay scrollbar as the other menus. `HoverCardContent` also keeps the scrollbar of a `ScrollArea` inside it clear of its corners.
