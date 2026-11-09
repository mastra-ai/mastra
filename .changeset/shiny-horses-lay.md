---
'@mastra/playground-ui': patch
---

Long Markdown lists now stay fast while a reply streams. `MarkdownRenderer` re-renders only the list item still being written instead of re-parsing the whole list on every chunk. Once the reply finishes, the list renders exactly as before. While it streams, a bold or italic marker the stream left open now closes inside the item being written, instead of spilling the next marker into it or showing as stray text below the list.
