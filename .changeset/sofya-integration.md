---
'@mastra/sofya': minor
---

Added the `@mastra/sofya` integration. It provides four web tools for agents, backed by the [Sofya](https://sofya.co) API: search (full page content, not just snippets), fetch (URLs to clean markdown), extract (pull specific data from a page with a prompt), and research (multi-source, cited reports).

```typescript
import { createSofyaTools } from '@mastra/sofya';

const tools = createSofyaTools(); // reads SOFYA_API_KEY from the environment
// tools.sofyaSearch, tools.sofyaFetch, tools.sofyaExtract, tools.sofyaResearch
```
