---
'@mastra/core': minor
---

`knowledge_search` page results now include a short `snippet` of the page body around the words that matched, so an agent can see why a page was found without reading the whole page. The snippet is at most 240 characters, is cut from the same words keyword search used (quotes removed, case-insensitive), and is left out when the body contains none of them, for example when only the name or description matched. Snippets are only built for pages the run can read.
