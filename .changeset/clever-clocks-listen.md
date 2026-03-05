---
'mastracode': patch
---

Improved web_search tool rendering in the TUI. Search results now display a clean list of titles and URLs with the search query in the header, instead of dumping raw JSON. Anthropic's web search tool includes large `encryptedContent` fields which are now stripped from the output.
