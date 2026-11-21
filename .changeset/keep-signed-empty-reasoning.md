---
'@mastra/core': patch
---

Keep the provider signature of a stored reasoning block that has no text details. Rows written before reasoning details were recorded are replayed to the provider instead of being dropped, so a signed thinking block is not lost when a conversation is rebuilt. Reasoning written by the current stream writer is unaffected: it already carries text details and survived.
