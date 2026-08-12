---
'@mastra/playground-ui': patch
---

Reworked the markdown renderer's typography. Headings, lists, blockquotes, tables and horizontal rules now follow one consistent rhythm, list markers and task-list checkboxes render as expected, and long tables scroll instead of stretching their container.

Fenced code blocks render through the design-system `CodeBlock` — syntax highlighting, a copy button and a proper frame — and yaml, diff, css, html, xml and sql were added to the highlighted languages, so fences in those languages are no longer plain text.
