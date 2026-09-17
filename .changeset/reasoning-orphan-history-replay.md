---
'@mastra/core': patch
---

Keep stored reasoning when a client resends an assistant message.

Chat clients such as `useChat` echo the assistant messages they have received back to the server on the next turn, keyed by message id. That echo is lossy: reasoning parts are gone and provider metadata (OpenAI `itemId`s) is often dropped. Previously the echo replaced the message Memory had already persisted, so on reasoning-capable OpenAI models the next request contained the assistant `msg_*` item without its `rs_*` reasoning item and the Responses API rejected it:

> Item 'msg_*' of type 'message' was provided without its required 'reasoning' item.

The lossy echo was then also written back to storage, permanently removing the reasoning from the thread.

Now the stored copy is authoritative for what the echo lost. Reasoning parts and provider metadata are restored from storage, client-side updates the echo does carry (for example tool output added with `addToolResult`) are kept, and the echo is no longer re-persisted over the stored message. Request bodies for turns that had no stored reasoning are unchanged.

Fixes #24052.
