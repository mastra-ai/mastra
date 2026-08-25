---
'@mastra/code-sdk': minor
---

Added Parallel as a configured web search provider in Mastra Code, alongside Tavily. Set PARALLEL_API_KEY to enable Parallel-backed web_search and web_extract tools, and pick your default provider in the TUI under /settings → Web search provider (providers are selectable only while their API key is configured; Auto uses the first configured key).

```bash
PARALLEL_API_KEY=your-api-key npx mastracode --prompt "Use web_search to find the latest Mastra release"
```
