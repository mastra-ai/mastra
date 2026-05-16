---
'@mastra/client-js': minor
---

Added typed client-side resources and types for the new stored-entity HTTP surface.

- `client.storedAgents` / `client.storedSkills` resources now cover list/get/create/update/delete, publish/activate/restore, version listing, and favorite toggling.
- Added stored-entity request/response types (visibility, favorite counts, `isFavorited`, version metadata) to the public `types` module.
- Regenerated `route-types.generated.ts` to reflect the new route surface, including the editor-builder settings/infrastructure endpoints and the external skill-registry endpoints under `/editor/builder/registries`.
