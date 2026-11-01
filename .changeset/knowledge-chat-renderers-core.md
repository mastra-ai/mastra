---
'@mastra/core': patch
---

Knowledge notes returned by `knowledge_note`, `knowledge_read` and `knowledge_search` now carry `mentions`, mapping each `[[ref]]` in the note to the page id it resolves to, so a chat can link them. Refs are resolved the way the note's write resolved them; a name that no longer resolves is left out.

```json
{ "id": "n1", "text": "Escalate per [[Escalation Process]].", "mentions": { "Escalation Process": "page-esc" } }
```
