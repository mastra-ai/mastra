---
'mastracode': patch
---

Added a Web search provider setting to /settings for choosing the default web_search/web_extract provider (Tavily or Parallel). Every provider stays visible in the selector; ones missing their API key are marked unavailable with the env var to set, and Auto uses the first configured key.

```bash
PARALLEL_API_KEY=your-api-key npx mastracode
# then: /settings → Web search provider → Parallel
# and in chat: "Use web_search to find the latest Mastra release"
```
