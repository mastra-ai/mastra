---
'@mastra/core': patch
---

Fixed client-sent assistant messages changing stored assistant text. When a request includes an assistant message with the same ID as a stored one, only tool outcomes for calls the stored message still has pending are applied. Client text, reasoning, and metadata no longer replace or add to the stored message. This applies even with `retainFullInput`, so an output processor's rewrite of a saved message (for example, redacting a card number) can't be undone by the client's rendered copy.

Fixes #20836.
