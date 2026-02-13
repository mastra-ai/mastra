---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
---

Added draft/publish version resolution for editor primitives (agents, scorers, MCP clients, prompt blocks).

**Status filtering on list endpoints** — All list endpoints (e.g., `GET /stored/agents`) now accept a `?status=draft|published|archived` query parameter to filter by entity status. Defaults to `published` to preserve backward compatibility.

**Draft vs published resolution on get-by-id endpoints** — `GET /stored/agents/:id`, `GET /stored/scorers/:id`, and `GET /stored/mcp-clients/:id` now accept `?status=draft` to resolve the entity with its latest (unpublished) version, or `?status=published` (default) to resolve with the active published version.

**Edits no longer auto-publish** — When updating an agent, a new version is created but `activeVersionId` is no longer automatically updated. Edits stay as drafts until explicitly published via the activate endpoint (`POST /stored/agents/:id/versions/:versionId/activate`).

```ts
// Fetch the published version (default behavior, backward compatible)
const published = await fetch('/api/stored/agents/my-agent');

// Fetch the draft version for editing in the UI
const draft = await fetch('/api/stored/agents/my-agent?status=draft');

// List only draft entities
const drafts = await fetch('/api/stored/agents?status=draft');
```
