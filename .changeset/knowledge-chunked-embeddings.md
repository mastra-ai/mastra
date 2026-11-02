---
'@mastra/core': patch
---

Knowledge pages too long for the embedder are now searchable by meaning. A long page is embedded as overlapping chunks of about 2,000 tokens, cut between paragraphs and before headings, and semantic search still returns the page once, ranked by its best chunk. Before, the embedder refused these pages and they could only be found by keyword. Rewriting a page replaces its chunks, and deleting it removes them all. Pages embedded before this change keep working; run `knowledge.reindex()` to chunk pages that were too long.
