---
'@mastra/core': patch
---

Improve error messaging for LLM API errors. When an error originates from an LLM provider (e.g., rate limits, overloaded, auth failures), the console now indicates it's an upstream API error and includes the provider and model information.

Before:

```
ERROR (Mastra): Error in agent stream
    error: { "message": "Overloaded", "type": "overloaded_error" }
```

After:

```
ERROR (Mastra): Upstream LLM API error from anthropic (model: claude-3-opus)
    error: { "message": "Overloaded", "type": "overloaded_error" }
```
