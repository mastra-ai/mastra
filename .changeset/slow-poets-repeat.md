---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
---

Added draft/publish version management for all editor primitives (agents, scorers, MCP clients, prompt blocks).

**Status filtering on list endpoints** — All list endpoints now accept a `?status=draft|published|archived` query parameter to filter by entity status. Defaults to `published` to preserve backward compatibility.

**Draft vs published resolution on get-by-id endpoints** — All get-by-id endpoints now accept `?status=draft` to resolve the entity with its latest (unpublished) version, or `?status=published` (default) to resolve with the active published version.

**Edits no longer auto-publish** — When updating any primitive, a new version is created but `activeVersionId` is no longer automatically updated. Edits stay as drafts until explicitly published via the activate endpoint.

**Full version management for all primitives** — Scorers, MCP clients, and prompt blocks now have the same version management API that agents have: list versions, create version snapshots, get specific versions, activate/publish, restore from a previous version, delete versions, and compare versions.

**New prompt block CRUD routes** — Prompt blocks now have full server routes (`GET /stored/prompt-blocks`, `GET /stored/prompt-blocks/:id`, `POST`, `PATCH`, `DELETE`).

**New version endpoints** — Each primitive now exposes 7 version management endpoints under `/stored/{type}/:id/versions` (list, create, get, activate, restore, delete, compare).

```ts
// Fetch the published version (default behavior, backward compatible)
const published = await fetch('/api/stored/scorers/my-scorer');

// Fetch the draft version for editing in the UI
const draft = await fetch('/api/stored/scorers/my-scorer?status=draft');

// Publish a specific version
await fetch('/api/stored/scorers/my-scorer/versions/abc123/activate', { method: 'POST' });

// Compare two versions
const diff = await fetch('/api/stored/scorers/my-scorer/versions/compare?from=v1&to=v2');
```
