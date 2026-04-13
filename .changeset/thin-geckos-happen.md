---
'@mastra/ai-sdk': patch
'@mastra/core': patch
---

Fixed separate-model structured output streaming so main text continues to stream while structured output is still captured reliably.

Improved regression coverage for structured output with memory and streaming. This helps prevent leaked structured JSON from being saved or surfaced as assistant text in follow-up turns.
