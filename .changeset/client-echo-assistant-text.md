---
'@mastra/core': patch
---

Fixed client-sent copies of stored messages changing what's stored. When a request includes a message with the same ID as a stored one, the stored message is kept as is. For assistant messages, the only thing taken from the client copy is a tool outcome for a call the stored message still has pending. Client text, reasoning, and metadata no longer replace or add to the stored message. To change a stored message, update it in storage. This applies even with `retainFullInput`, so an output processor's rewrite of a saved message (for example, redacting a card number) can't be undone by the client's rendered copy.

Fixes #20836.
