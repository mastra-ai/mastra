---
'mastra': minor
---

Added a Knowledge page to Mastra Studio that browses a Knowledge instance registered on the server. It shows every scope and page as a tree beside either a graph of the pages or a full page view: the page's markdown body, path, version, child pages, the pages that mention it, its notes and recent activity. The tree loads each level as it is opened, so every page is reachable. It searches pages and notes, and `?page=` links open a page directly. It follows the server's change stream, so pages and edits agents write show up as they happen; against a server that can't stream changes it refreshes every few seconds instead. On narrow screens the same toggle also offers the tree.

The page needs the Knowledge routes, which are not served by default. Register them on your Mastra instance:

```ts
import { KNOWLEDGE_ROUTES } from '@mastra/server/server-adapter';

new Mastra({
  server: { apiRoutes: [...KNOWLEDGE_ROUTES] },
});
```

Until then the page explains how to enable them.
