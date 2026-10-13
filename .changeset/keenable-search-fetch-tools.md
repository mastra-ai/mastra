---
'@mastra/keenable': minor
---

Added Keenable web search and page fetch tools for Mastra agents through the new `@mastra/keenable` package. The tools work without an API key.

```typescript
import { createKeenableTools } from '@mastra/keenable'

const tools = createKeenableTools()
```
