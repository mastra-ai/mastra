---
'@mastra/memory': minor
---

Added tokenx-based local token estimation for Observational Memory thresholding.

**What changed**

- Replaced the previous js-tiktoken-based local estimator with tokenx for OM message and attachment threshold checks.
- Kept multimodal thresholding accurate with the existing provider-aware image heuristics and deterministic fallbacks.
- Invalidated old OM token-estimate cache entries so fresh counts are stored with the new estimator source.

**Why**
This reduces the local CPU and memory overhead of OM thresholding while keeping its behavior and cache metadata predictable.
