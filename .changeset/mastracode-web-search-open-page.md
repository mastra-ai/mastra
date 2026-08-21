---
'mastracode': patch
---

Fixed the TUI showing a bare `web_search` line when the model opened a page instead of searching.

A provider-run web search sends no input, so the line had nothing to show. It now reads the call back out of the result: `web_search "https://mastra.ai/docs"` for an opened page, with the page listed underneath, and the query for a search — including the several queries one OpenAI search can run.
