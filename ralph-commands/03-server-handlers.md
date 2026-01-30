<background>
You are a senior TypeScript developer working on Mastra framework server handlers for the stored agents feature. Commands 1-2 have updated the core types and all storage adapters. The agent record is now metadata-only with a status field (draft/published), and all config lives as top-level columns on version rows (no nested snapshot object -- the version row IS the snapshot).

Key behaviors to implement:
- CREATE handler: Creates agent (status='draft') with version 1 via the storage layer. Returns the resolved agent (metadata + version config merged).
- PATCH/UPDATE handler: Passes update to storage layer which separates metadata updates from config updates. Config changes create a new version WITHOUT activating. Does NOT call handleAutoVersioning to set activeVersionId. Returns the resolved agent.
- GET handler: Returns the resolved agent (metadata + active version config, or latest if no active).
- LIST handler: Returns resolved agents.
- ACTIVATE endpoint: Sets activeVersionId AND status='published' on the agent record.
- handleAutoVersioning: Should no longer set activeVersionId -- only create the version and enforce retention. Actually, with the new storage layer handling version creation on config updates, handleAutoVersioning may be largely unnecessary. Evaluate whether to simplify or remove it.
- Dangling activeVersionId: If activeVersionId points to a nonexistent version, log a warning (not silently fall back).
- Response schemas need status and activeVersionId fields.

Read STORED_AGENTS_FEATURE.md in the repo root for full feature context.
</background>

<setup>
1. Read STORED_AGENTS_FEATURE.md for full feature context
2. Read packages/core/src/storage/types.ts for updated types
3. Read packages/server/src/server/handlers/stored-agents.ts -- full file, all CRUD handlers
4. Read packages/server/src/server/handlers/agent-versions.ts -- full file, especially handleAutoVersioning (line 286+), createVersionWithRetry (line 220+), enforceRetentionLimit, calculateChangedFields
5. Read packages/server/src/server/schemas/stored-agents.ts -- full file, all Zod schemas
6. Read packages/server/src/server/schemas/agent-versions.ts -- full file
7. Read packages/server/src/server/server-adapter/routes/stored-agents.ts -- route registration
</setup>

<tasks>
1. Update storedAgentSchema in packages/server/src/server/schemas/stored-agents.ts: Add status (z.enum with values 'draft' and 'published') and activeVersionId (z.string().optional()). The response schema should represent the RESOLVED agent (metadata + snapshot merged), so keep the config fields (name, description, instructions, model, tools, etc.) in the response schema -- they come from the version row now. Update the memory field from z.string() to z.record(z.string(), z.unknown()) to match the new object config type.

2. Update createStoredAgentSchema: The create request body needs both the agent metadata fields (id, authorId, metadata) and initial config (name, instructions, model, tools, etc.). Structure the Zod schema to accept all these fields.

3. Update updateStoredAgentSchema: The update request body accepts optional metadata fields (authorId, metadata) and optional config fields (name, description, instructions, model, tools, etc.). All optional for partial updates.

4. Update the CREATE handler in stored-agents.ts: Call agentsStore.createAgent with the full input (metadata + config). The storage layer handles creating the agent record and version 1. Return the resolved agent. Clear any relevant caches.

5. Update the UPDATE handler in stored-agents.ts: Pass the update fields to agentsStore.updateAgent. The storage layer separates metadata vs config and creates a version if config changed. REMOVE or simplify the call to handleAutoVersioning -- since the storage layer now handles version creation on config updates, handleAutoVersioning is redundant for that purpose. If retention enforcement is still needed, call enforceRetentionLimit directly. Clear agent cache after update.

6. In packages/server/src/server/handlers/agent-versions.ts, update handleAutoVersioning: Either remove it entirely (if the storage layer handles everything) or strip it down to only enforce retention limits. Remove the line that updates activeVersionId (currently around line 308-311). Remove the line that creates the version (the storage layer does this now).

7. Update the ACTIVATE endpoint handler in agent-versions.ts: When activating a version, update the agent record to set BOTH activeVersionId to the version ID AND status to 'published'. Currently it only sets activeVersionId.

8. Update the GET handler: It should call getAgentByIdResolved (which returns the merged metadata + version config). The response includes status and activeVersionId alongside all config fields.

9. Update the LIST handler: Use listAgentsResolved to return resolved agents. Include status and activeVersionId in each agent response.

10. Add error logging for dangling activeVersionId: In the resolution path (either in the server handler or in getAgentByIdResolved on the base class), when activeVersionId is set but getVersion returns null, log a warning with the agent ID and dangling version ID. This should have been added in Command 2 on the base class -- if not, add it here.

11. Update the RESTORE handler: When restoring from an old version, it copies the old version config to create a new version. With the new model, restoring should create a new version from the old version config and optionally activate it. Remove any manual field stripping from the restore handler since version config fields no longer include agent-record fields (they are top-level on the version row).

12. Update the DELETE version handler: Ensure it still prevents deleting the active version (returns 400). Check that the status field is NOT changed when a non-active version is deleted.
</tasks>

<testing>
1. Build the server package and fix any type errors
2. Run any existing server handler tests for stored agents and versions
3. Verify the Zod schemas validate correctly for create, update, and response payloads
</testing>

Output <promise>COMPLETE</promise> when all tasks are done.
