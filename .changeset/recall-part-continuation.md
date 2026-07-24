---
"@mastra/memory": patch
---

Added continuation support to the Observational Memory `recall` tool. When a single message part is larger than the result budget, the result now includes `nextCharOffset` and a note explaining how to fetch the next chunk, so oversized parts can be read across multiple calls instead of returning the same truncated prefix every time.

```json
{ "mode": "messages", "cursor": "<message-id>", "partIndex": 0, "detail": "high", "charOffset": 8000 }
```

Fixes [#19817](https://github.com/mastra-ai/mastra/issues/19817).
