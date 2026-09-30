---
'@mastra/playground-ui': patch
---

Fixed system messages in trace previews showing raw markdown (like `#` and `**`). They are now rendered as formatted text, like user and assistant messages. Long span input and output boxes (Preview and JSON) are now collapsed with an Expand button instead of scrolling inside a fixed height.
