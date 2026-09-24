---
'@mastra/memory': minor
---

`recall({ vectorSearchString })` and the message writes behind it now work against a vector store that generates embeddings itself, matching the agent-turn path. With such a store and no `embedder` configured, saved messages are sent as text and the search string is embedded server-side.
