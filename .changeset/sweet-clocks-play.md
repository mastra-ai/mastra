---
'@mastra/server': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/core': patch
'@mastra/editor': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

CMS draft support with status badges for agents.

- Agent list now resolves the latest (draft) version for each stored agent, showing current edits rather than the last published state.
- Added `hasDraft` and `activeVersionId` fields to the agent list API response.
- Agent list badges: "Published" (green) when a published version exists, "Draft" (colored when unpublished changes exist, grayed out otherwise).
- Added `resolvedVersionId` to all `StorageResolved*Type` types so the server can detect whether the latest version differs from the active version.
- Added `status` option to `GetByIdOptions` to allow resolving draft vs published versions through the editor layer.
- Fixed editor cache not being cleared on version activate, restore, and delete — all four versioned domains (agents, scorers, prompt-blocks, mcp-clients) now clear the cache after version mutations.
- Added `ALTER TABLE` migration for `mastra_agent_versions` in libsql and pg to add newer columns (`mcpClients`, `requestContextSchema`, `workspace`, `skills`, `skillsFormat`).
