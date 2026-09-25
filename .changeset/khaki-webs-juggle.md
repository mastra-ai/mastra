---
'@mastra/memory': minor
---

`recall({ vectorSearchString })` and the message writes behind it now work against a vector store that generates embeddings itself, matching the agent-turn path. With such a store and no `embedder` configured, saved messages are sent as text and the search string is embedded server-side.

`cloneThread` and `updateThreadResourceId` reach the same path. A cloned thread's messages are embedded for semantic recall, and transferring a thread to another resource moves its message vectors to the new owner so resource-scoped recall keeps finding them.
