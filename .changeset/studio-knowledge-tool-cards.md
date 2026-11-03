---
'@mastra/playground-ui': patch
'mastra': patch
---

Knowledge tool calls in chat now draw as readable cards instead of raw JSON. `knowledge_search` lists its hits, `knowledge_read` shows the page with its markdown body, notes, child pages and the notes that mention it, `knowledge_page` says whether it created, updated, moved or merged a page and shows the new body and version, `knowledge_note` shows the note it added, and `knowledge_pin` names the audience. Each page name links to that page in Studio's Knowledge viewer (`/knowledge?page=<id>&view=page`). Running and failed calls keep the plain tool badge.
