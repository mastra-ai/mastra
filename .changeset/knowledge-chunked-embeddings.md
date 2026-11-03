---
'@mastra/core': patch
---

Knowledge pages too long for the embedder are now searchable by meaning. A long page is embedded as overlapping chunks of about 2,000 tokens, cut between paragraphs and before headings, and semantic search still returns the page once, ranked by its best chunk. Before, the embedder refused these pages and they could only be found by keyword. Rewriting a page replaces its chunks, and deleting it removes them all. Pages embedded before this change keep working; a page that was too long is chunked the next time it changes.

A page is embedded as at most 100 chunks (about 200,000 tokens of body); past that, the rest of the body is found by keyword only. A page's name and description lead every chunk, up to 500 tokens. One semantic search looks at up to 1,000 distinct pages and notes (up to 10,000 vectors). A rewrite drops the page's old chunks by id after the new ones are stored; on a vector store that can't delete by id, old chunks stay but only ever point back to the same page.
