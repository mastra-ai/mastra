---
'@mastra/core': patch
---

The `knowledge_note` tool no longer requires `scope` when adding a note. A note added without `scope` is stamped with the page's own scope, so everyone who can read the page sees it. Pass narrower scopes to keep a note private. Restamping a note still requires `scope`.
