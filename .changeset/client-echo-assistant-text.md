---
'@mastra/core': patch
---

Fixed client-sent copies of stored messages changing what's stored. When a request includes a message with the same ID as a stored one:

- The stored message is kept as is. Client text, reasoning, and metadata no longer replace or add to it.
- For assistant messages, the client copy can only fill in a tool outcome for a call the stored message still has pending.
- To change a stored message, update it in storage.
- This also applies with `retainFullInput`, so the client's rendered copy can't undo an output processor's rewrite of a saved message, such as a redacted card number.

Fixes #20836.
