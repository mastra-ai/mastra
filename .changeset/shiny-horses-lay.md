---
'@mastra/playground-ui': patch
---

Long Markdown lists now stay fast while a reply streams. `MarkdownRenderer` re-renders only the list item still being written instead of re-parsing the whole list on every chunk, and the list renders exactly as before.
