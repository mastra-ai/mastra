---
'@mastra/core': patch
---

Fixed AI SDK v5 streams so provider metadata is preserved when a text delta is empty. This keeps Google Gemini thought signatures and other provider continuity metadata available to downstream consumers. Empty deltas without provider metadata remain omitted. Relates to https://github.com/mastra-ai/mastra/issues/20469
