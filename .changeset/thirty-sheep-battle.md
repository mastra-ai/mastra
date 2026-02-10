---
'@mastra/evals': patch
---

Fixed LLM scorer schema compatibility with Anthropic API by replacing `z.number().min(0).max(1)` with `z.number().refine()` for score validation. The min/max constraints were being converted to JSON Schema minimum/maximum properties which some providers don't support.
