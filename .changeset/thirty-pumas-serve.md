---
'@mastra/playground-ui': patch
---

Fixed system messages in trace previews showing raw markdown (like `#` and `**`). They are now rendered as formatted text, like user and assistant messages. Long span input and output boxes (Preview and JSON) are now collapsed with an Expand button instead of scrolling inside a fixed height.

Added `CollapsibleBox` and `useCollapsibleBox`: a box that clips content past a measured height with a fade, while you place the expand control anywhere. The `Plan` component now uses it.
