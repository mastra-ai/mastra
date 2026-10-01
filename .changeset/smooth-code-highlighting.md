---
'@mastra/playground-ui': patch
---

Fixed the page freezing when opening a Markdown file with many code blocks. Syntax highlighting now runs one block at a time and yields to the browser in between, so the page stays responsive while blocks colour in. Repeated highlights of the same code are cached, and very large sources (over 200,000 characters) are shown without highlighting.
