---
'@mastra/connect': minor
'@mastra/mcp-docs-server': patch
'@mastra/client-js': patch
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'@mastra/mysql': patch
'@mastra/turso': patch
'@mastra/pg': patch
---

**Added** `importers()` — a live async resolver of Knowledge importer definitions from Mastra Platform connections. Pass it directly to `new Knowledge({ importers })`; connections attached or detached on the platform start or stop syncing without a restart.

Five built-in providers ship in the `IMPORTERS` registry: Notion (pages and databases), Confluence (pages), Linear (Documents — knowledge, not issue tracking), Zendesk (Help Center articles — not tickets), and Fireflies (meeting transcripts). Jira is deliberately not an importer — it remains a work-intake source. Each is a deterministic cursor-based sync through the platform proxy (no source credentials in your process), with content-hashed record ids for idempotent re-runs and durable watermark state that only advances after mutations commit.

Importers also emit the relationships their source natively knows as `metadata.links` on records (new exported `RecordLink` type): cross-references (Notion page links, Confluence `<ri:page>` links, Linear doc URLs, Zendesk article hrefs) and containment structure (Notion parents, Confluence ancestors, Linear projects, Zendesk sections, Fireflies attendees + recurring-meeting series). Notion now fetches page bodies via a bounded `blocks/{id}/children` walk — pages carry their block text, not just titles and properties. Every node is stamped with its own address in metadata (`address`, plus `addressAliases` for Linear slug-form links) so render layers can resolve link targets without extra lookups. Link arrays are part of each record's content hash, so the first run after this upgrade re-records every entity once (owner-role bindings clean up the stale generation; `edit`-role bindings — Fireflies by default — keep one stale generation per node).

```typescript
import { Knowledge } from '@mastra/core/knowledge';
import { importers } from '@mastra/connect';

new Knowledge({
  storage,
  importers: importers({
    projectId: process.env.MASTRA_PROJECT_ID,
    integrations: {
      notion: { scope: 'org:acme' },
      linear: { scope: 'org:acme:engineering' },
      fireflies: { scope: 'org:acme' },
    },
  }),
});
```
