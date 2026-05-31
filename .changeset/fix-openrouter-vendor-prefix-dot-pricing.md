---
'@mastra/observability': patch
---

Fix null `estimatedCost` for OpenRouter models whose id carries a vendor prefix and a dotted version (e.g. `google/gemini-2.5-flash`). These previously failed to match the pricing data (`gemini-2-5-flash`), leaving cost unreported in Studio's "Total Model Cost". Cost is now estimated correctly for these routes.
