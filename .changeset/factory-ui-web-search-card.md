---
'@mastra/factory': patch
---

Fixed web search cards in the chat transcript reading as an empty tool call.

Providers that run the search themselves send no tool input, so the card showed `{}` above a raw provider payload — and said "Search the web" even when the model had opened a page. The card now names the action it was (search, open page, find in page) with its query or URL, and lists the pages found as links.
