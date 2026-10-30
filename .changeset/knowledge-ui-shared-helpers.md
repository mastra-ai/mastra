---
'@mastra/playground-ui': patch
---

Added the Knowledge explorer (graph, node and record views, pins, scope view, search) under `@mastra/playground-ui/domains/knowledge`, moved out of Factory UI so Mastra Studio can reuse it. Hosts supply their data through `KnowledgeDataSourceProvider`.
