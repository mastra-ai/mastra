---
'@mastra/playground-ui': patch
---

Reworked the markdown renderer's typography. Headings, lists, blockquotes, tables and horizontal rules now follow one consistent rhythm, list markers and task-list checkboxes render as expected, and long tables scroll instead of stretching their container.

Rendered markdown now inherits the text color and size of the surface it sits on, so a muted parent (a reasoning trail, a system notice) stays muted instead of being overridden by the renderer.

Fenced code blocks render through the design-system `CodeBlock` — syntax highlighting, a copy button and a proper frame — and yaml, diff, css, html, xml and sql were added to the highlighted languages, so fences in those languages are no longer plain text.
