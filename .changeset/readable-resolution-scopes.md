---
'@mastra/core': patch
---

Knowledge record creation now rejects resolution scopes the caller cannot read, so a wikilink to an importer address can no longer bind a node hidden from the writer.
