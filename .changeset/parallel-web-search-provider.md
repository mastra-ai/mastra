---
'@mastra/code-sdk': minor
---

Added Parallel as an opt-in web search and extraction provider for Mastra Code.

When `PARALLEL_API_KEY` is configured in your environment, Mastra Code enables Parallel-backed implementations of the built-in `web_search` and `web_extract` tools. This provides a model-independent search solution for models that lack native web search capabilities without needing manual MCP server configuration.

**Precedence:**
1. Tavily (`TAVILY_API_KEY`)
2. Parallel (`PARALLEL_API_KEY`)
3. Anthropic / OpenAI native model search (when supported by the active model)

**Example tool call input:**

```json
{
  "search_queries": ["mastra agents documentation", "mastra dynamic workflows"],
  "objective": "Find documentation and examples for configuring agents and workflows in Mastra"
}
```

