---
'@mastra/playground-ui': patch
---

Improved text wrapping so fewer lines of text end with a single word on their own line, in browsers that support `text-wrap: pretty`. Paragraphs, descriptions, notices, toasts and tooltips now wrap with `text-wrap: pretty` by default, and empty states balance their title and description lines. Code, inputs and streamed Markdown keep normal wrapping.
