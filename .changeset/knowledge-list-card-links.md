---
'@mastra/playground-ui': patch
'mastra': patch
---

Each entry in the `knowledge_list` chat card now links to its page in Studio's Knowledge view, like the `knowledge_search` card does. Scope roots open their scope page, and nested pages open at any depth. Hosts that open pages only by id can leave out the new `refHref` on `KnowledgeLinksProvider`, and the entries stay plain text.
