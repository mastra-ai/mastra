---
'@mastra/connect': minor
---

Added `importers()` to `@mastra/connect`: Knowledge importers built from the provider connections on your Mastra platform project.

Pass the resolver to `Knowledge` and every active connection to a supported provider becomes an importer that syncs that provider's content into the scopes you choose, on a schedule. New connections are picked up without a restart.

```ts
import { importers } from '@mastra/connect';
import { Knowledge } from '@mastra/core/knowledge';

export const knowledge = new Knowledge({
  storage,
  importers: importers({
    integrations: {
      notion: { scope: 'org:acme' },
      linear: { scope: 'org:acme', schedule: '*/30 * * * *' },
    },
  }),
});
```

**Supported providers**

- Notion pages, following the page hierarchy
- Confluence pages, following page ancestors
- Linear documents, grouped by project and initiative
- Zendesk help center articles, grouped by section
- Fireflies meeting transcripts, linked to attendees

Each importer pages through the provider API via the platform proxy, resumes long syncs across runs, and removes content that was deleted at the source when it owns the destination scope. To pick destination scopes per connection at run time, pass a `scopes` function together with an `access` map such as `{ 'resource:$projectId': 'owner' }`.
