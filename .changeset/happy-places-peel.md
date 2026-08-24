---
'@mastra/code-sdk': minor
---

Added Parallel as the primary configured web search provider in Mastra Code. Set PARALLEL_API_KEY to use Parallel-backed web_search and web_extract tools.

```bash
PARALLEL_API_KEY=your-api-key npx mastracode --prompt "Use web_search to find the latest Mastra release"
```
