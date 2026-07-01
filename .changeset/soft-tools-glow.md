---
'mastracode': patch
---

Improved tool-call rendering in the MastraCode web studio chat. Tool arguments, results, and full-file writes now render through the design-system `CodeBlock` component (shiki syntax highlighting, built-in copy button, softer rounded shape) instead of plain monospace `<pre>` blocks, and the tool card container and inline diff use a gentler rounded shape. This matches the Studio playground and makes tool output easier to read.
