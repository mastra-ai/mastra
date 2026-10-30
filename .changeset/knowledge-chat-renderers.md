---
'@mastra/playground-ui': patch
'@mastra/factory': patch
'mastra': patch
---

Pinned Knowledge now shows in chat as a card instead of raw `{id: …}` text. A snapshot reads "Pinned knowledge · N pages" and lists each pinned page by name and scope, with the text the agent was given behind a toggle. A delta lists the pages added (+), changed (~) and removed (−) since. Every page links to the Knowledge viewer. Factory's chat now draws Knowledge tool calls (`knowledge_search`, `knowledge_read`, `knowledge_page`, `knowledge_note`, `knowledge_pin`) the same way Studio does, and links pages to that Factory's Knowledge page. Hosts with their own Knowledge route can wrap chat in `KnowledgeLinksProvider` to point those links there.
