---
'@mastra/observability': patch
---

Improved model usage normalization and total cost reporting. Model generation spans now populate input and output text detail buckets from the reported totals when providers do not supply a full breakdown, and `mastra_model_total_input_tokens` / `mastra_model_total_output_tokens` now include estimated cost based on the successfully priced detail buckets for those totals.
