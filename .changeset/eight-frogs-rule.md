---
'@mastra/core': patch
---

Fixed duplicate OpenAI item IDs (rs*\*, msg*\*) caused by eager mid-stream flushing of text and reasoning deltas. Replaced the stateful flush-based message building in processOutputStream with a post-stream approach that collects all chunks first and assembles messages from the complete sequence. This also fixes empty text parts being persisted from empty-string text-delta artifacts, and incorrect providerMetadata attribution where interrupting chunks leaked metadata into flushed parts.
