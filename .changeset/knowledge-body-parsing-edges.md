---
'@mastra/core': patch
---

Improved how Knowledge reads fenced code and headings in page bodies, to match CommonMark:

- Fenced code ends only on a fence of the same character, at least as long, with nothing after it. A ```` ```` ```` block can show ```` ```js ```` lines without breaking a page's sections, outline or embedding chunks. A fence indented four or more spaces is indented code and doesn't open or close a block.
- A heading keeps a `#` that's part of its title: `## Use C#` is the section "Use C#".
- Reading the last part of a page whose body ends in a newline returns a range that `knowledge_page` accepts back for an edit.

Embedding a long page now runs up to 4 chunk embeddings at once (one at a time when the embedding model doesn't support parallel calls), and one semantic search looks at no more than 1,000 distinct pages and notes.
