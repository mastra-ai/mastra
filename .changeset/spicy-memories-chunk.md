---
'@mastra/memory': patch
---

Fixed semantic recall failing on long unbroken content. When a memory-enabled agent received a message containing a single very long whitespace-free string — a base64 data URI, a minified JS/JSON blob, a long URL, or spaceless CJK text — embedding could throw a provider "maximum context length" error and break that turn's persistence or recall.

`chunkText` now hard-splits any single word that is longer than the chunk budget so every chunk stays under the embedder's token limit, and it no longer emits an empty leading chunk when the first word is oversized.
