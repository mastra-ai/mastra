---
'mastra': minor
---

Added a Knowledge page to Mastra Studio that browses a Knowledge instance registered on the server: choose the instance and the scope tags to view through, then explore the graph, open nodes and their records, and search by name.

The page needs the Knowledge routes, which are not served by default. Register them on your Mastra instance:

```ts
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';

new Mastra({
  server: { apiRoutes: [...KNOWLEDGE_ROUTES] },
});
```

Until then the page explains how to enable them.