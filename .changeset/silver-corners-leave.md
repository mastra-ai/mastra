---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed MODEL_GENERATION and AGENT_RUN spans not reflecting model, provider, parameters, and availableTools overrides from input processors. Traces in Langfuse and other exporters now show the correct model info when a processor dynamically switches models.
