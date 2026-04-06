---
'@mastra/observability': patch
---

Fixed MODEL_STEP span input containing the entire raw HTTP request body instead of just the messages. Observability exporters (Datadog, Langfuse, etc.) now receive clean message arrays as MODEL_STEP span input.
