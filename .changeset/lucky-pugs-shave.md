---
'@mastra/core': patch
---

Turn-tag escaping no longer rescans a message from every `<turn` boundary, and a `userTurn` mark is dropped from messages nested in arrays. A message that opens a tag it never closes used to cost time quadratic in its length while sealing user text, and a nested message array could carry a client-supplied authored turn into the prompt.
