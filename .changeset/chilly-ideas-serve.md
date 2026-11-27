---
'@mastra/observability': patch
---

Fixed token usage and cost missing from trace exporters such as Braintrust and Langfuse for model calls that Mastra hides inside its built-in processors, for example `structuredOutput` with a separate `model`. Each hidden model call now exports a model generation span and an inference span with the model, provider, and usage of the call, and without its input or output. These spans have `usageOnly: true` in their attributes. Token metrics for these calls now also include a cost.
