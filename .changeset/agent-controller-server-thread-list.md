---
'@mastra/server': patch
---

Limit the agent-controller thread-list route without initializing a session, and normalize positive fractional limits to match array slicing. Listing may read multiple pages to exclude forked threads, or the full resource when tags cannot be filtered by storage.
