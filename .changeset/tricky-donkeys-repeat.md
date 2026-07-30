---
'@mastra/core': patch
---

Fixed AI SDK v5 stream conversion dropping `text-delta` chunks that carry only `providerMetadata` and an empty delta. Providers such as Google Gemini emit metadata-only text deltas (for example thought signatures), and `convertFullStreamChunkToMastra` discarded them along with their metadata. Empty deltas with no provider metadata are still dropped. Relates to https://github.com/mastra-ai/mastra/issues/20469
