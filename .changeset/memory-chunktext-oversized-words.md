---
'@mastra/memory': patch
---

Fixed `chunkText` producing oversized chunks for whitespace-free content. It only split on whitespace, so a single long "word" — a base64 payload, a minified bundle, a long URL, or spaceless CJK text — became one chunk larger than the embedder's token limit, causing `embedMany` to reject and breaking semantic-recall indexing and recall for that turn. Oversized words are now hard-split by character count so every chunk stays within budget. Also fixed an off-by-one that emitted an empty leading chunk when the first word already exceeded the budget, which some embedding providers reject.
