---
'@mastra/core': patch
---

Some LLM providers (openrouter for ex) add response-metadata chunks after each text-delta, this was resulting in us flushing text deltas into parts after each delta, so our output messages (with streamVNext) would have a separate text part for each text delta, instead of one text part for the combined deltas
