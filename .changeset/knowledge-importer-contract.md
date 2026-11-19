---
'@mastra/core': minor
---

Added the Knowledge importer contract (experimental), exported from `@mastra/core/knowledge`. Nothing runs importers yet: this release has the types, the manifest and the host interface, so hosts and importer authors can build against them.

- `defineKnowledgeImporter({ id, label, settings, credentials, sync })` defines an importer that writes a source into Knowledge as items keyed by the source's own IDs. It checks the definition when you call it. `parseSettings` and `checkCredentials` check a binding's values.
- `definition.toManifest()` returns plain JSON for a UI: the settings form as draft-07 JSON Schema (the input side, so fields with defaults are optional), plus the credential slots and the default schedule.
- `KnowledgeImporterHost` is the interface a runner flushes numbered batches through. It comes with `knowledgeImporterFlushDigest` (SHA-256 over RFC 8785 canonical JSON) and `normalizeKnowledgeImporterFinish` for replay checks.

```ts
import { defineKnowledgeImporter } from '@mastra/core/knowledge';
import { z } from 'zod';

export const helpspot = defineKnowledgeImporter({
  id: 'helpspot',
  label: 'HelpSpot',
  settings: z.object({ baseUrl: z.url() }),
  credentials: { apiKey: { description: 'HelpSpot API token' } },
  async sync(ctx) {
    await ctx.items.upsert({ sourceId: 'request:1', title: 'Refunds', body: 'Ask first.' });
    await ctx.state.set('cursor', '1');
  },
});
```
