---
"mastra": minor
"@mastra/server": minor
---

Added `mastra api`, a machine-readable runtime CLI for calling Mastra server resources with JSON input and output.

The new API CLI supports agents, workflows, tools, MCP servers, memory threads, working memory, observability traces/logs/scores, datasets, and experiments. It includes schema-aware request handling so a single JSON input is split into path, query, and body fields based on server route contracts, plus ergonomic raw-input wrapping for tool execution.

Exposed a route-derived server API schema manifest at runtime and generated CLI route metadata from it, enabling `--schema` output, response-shape-aware normalization, and server-aligned pagination output.
