---
'@mastra/observability': patch
---

Fixed model cost reporting on total token metrics. `mastra_model_total_input_tokens` and `mastra_model_total_output_tokens` now include estimated cost for the full input and output totals, which makes dashboard and aggregate cost queries return the expected values.
