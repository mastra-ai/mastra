---
'@mastra/langfuse': patch
---

Fix Langfuse exporter to reuse existing traces when multiple root spans share the same traceId. This resolves an issue where multiple agent.stream() calls with client-side tools would create separate traces in Langfuse instead of grouping them under a single trace. The exporter now checks if a trace already exists before creating a new one, allowing proper trace consolidation for conversations with multiple agent interactions.

Fixes #8830
