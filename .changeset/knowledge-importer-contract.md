---
'@mastra/core': minor
---

Added the Knowledge importer contract (experimental), exported from `@mastra/core/knowledge`. It has the types, the manifest and the host interface, so hosts and importer authors can build against them.

- `class X extends KnowledgeImporter({ id, label, settings, credentials }) { async import(ctx) {} }` defines an importer that writes a source into Knowledge as items keyed by the source's own IDs. The declaration is checked when the class is defined. Each instance is one configured source (a binding: `id`, `target`, `settings`, `credentials`), and its credentials are checked when it's constructed.
- `ctx.fetch` is bound to the run's `ctx.signal`. A `signal` the importer passes is combined with it, never replaces it: cancel and the run's deadline always abort the fetch, and the importer's own signal still aborts it too.
- `X.toManifest()` returns plain JSON for a UI: the settings form as draft-07 JSON Schema (the input side, so fields with defaults are optional) and the credential slots.
- `KnowledgeImporterHost` is the interface a runner flushes numbered batches through. It comes with `knowledgeImporterFlushDigest` (SHA-256 over RFC 8785 canonical JSON) and `normalizeKnowledgeImporterFinish` for replay checks.
- `KnowledgeImporterServiceHost` (from `createKnowledgeImporterHost`) adds what a hosted scheduler needs, including `readRun(runId)`: a run's status and, once it has ended, the receipt its finish stored, with the `chain` decision to act on.

```ts
import { KnowledgeImporter } from '@mastra/core/knowledge';
import { z } from 'zod';

export class HelpSpotImporter extends KnowledgeImporter({
  id: 'helpspot',
  label: 'HelpSpot',
  settings: z.object({ baseUrl: z.url() }),
  credentials: { apiKey: { description: 'HelpSpot API token' } },
}) {
  async import(ctx) {
    await ctx.items.upsert({ sourceId: 'request:1', title: 'Refunds', body: 'Ask first.' });
    await ctx.state.set('cursor', '1');
  }
}
```
