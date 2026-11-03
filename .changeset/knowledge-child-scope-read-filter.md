---
'@mastra/core': patch
---

`knowledge_list` now asks the store for only the child scopes the agent can read, and counts them in one call per level, instead of reading every child scope and dropping the unreadable ones. Listing under a scope with many private child scopes no longer loads all of them.
