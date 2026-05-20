---
'@mastra/server': minor
---

Added an HTTP surface for stored agents/skills/workspaces, plus introspection endpoints for the agent-builder and an external skill-registry proxy. Studio and the client SDK use these endpoints to back the new "stored entity" management UI.

```http
# Browse + manage stored entities (responses include favoriteCount + isFavorited)
GET    /stored/agents?visibility=public&page=1&perPage=20
GET    /stored/agents/:id
POST   /stored/agents
PATCH  /stored/agents/:id
DELETE /stored/agents/:id

# Versioning
POST   /stored/skills/:id/publish
POST   /stored/skills/:id/activate
POST   /stored/skills/:id/restore

# Favorites
PUT    /stored/agents/:id/favorite
DELETE /stored/agents/:id/favorite

# Builder introspection
GET    /editor/builder/settings
GET    /editor/builder/infrastructure

# External skill registry proxy (skills.sh)
GET    /editor/builder/registries
GET    /editor/builder/registries/:registryId/search
GET    /editor/builder/registries/:registryId/popular
GET    /editor/builder/registries/:registryId/skills/:owner/:repo/preview
POST   /editor/builder/registries/:registryId/skills/:owner/:repo/install
```

Highlights:

- **Visibility + authorship gating.** Stored agents/skills now resolve a caller's author identity from the request context. Non-admin users only see their own + public entities. Admins see everything.
- **Favorites.** List/get responses include `favoriteCount` and the caller's `isFavorited` flag. `PUT`/`DELETE /stored/{agents|skills}/:id/favorite` toggle the favorite for the caller.
- **Avatar validation.** Stored-agent/skill metadata avatars are validated through a new `validateMetadataAvatarUrl` helper (rejects payloads over the size limit or with malformed base64).
- **Model-policy enforcement.** Stored-agent create/update routes invoke `assertModelAllowed` via the new `resolveBuilderModelPolicy` helper. Disallowed models map to HTTP 422 with a structured body — `{ code, attempted, offendingLabel, allowed }` — via `handleError`'s new `ModelNotAllowedError` mapping.
- **Builder introspection.** `GET /editor/builder/settings` returns feature flags, configuration, picker visibility, and model policy. `GET /editor/builder/infrastructure` reports browser-provider and sandbox status. Both default to `{ enabled: false }` when no `MastraEditor` is configured.
- **External skill registry.** `/editor/builder/registries/*` proxies the public skills.sh catalog so the builder UI can browse and install registered skills.

This also bumps the `@mastra/core` peer dependency floor to `>=1.34.0-0` (see the separate changeset) because the new handlers and error mapping import runtime values from `@mastra/core/agent-builder/ee`.
