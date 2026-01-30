<background>
You are a senior TypeScript developer working on Mastra framework core integration and client SDK for the stored agents feature. Commands 1-3 have updated types, storage adapters, and server handlers. The agent record is now metadata-only with a status field (draft/published), and all config lives as top-level columns on version rows (no nested snapshot object -- the version row IS the snapshot, typed as StorageAgentSnapshotType).

Key changes needed:
- getStoredAgentById fetches the thin agent record, then resolves the version config to create an Agent instance
- createAgentFromStoredConfig receives a StorageResolvedAgentType (or agent metadata + version config separately) instead of StorageAgentType
- memory resolution changes from string key lookup to object config handling
- Client SDK types need status and activeVersionId fields, and memory changes to object type
- listStoredAgents uses resolved data from storage layer

Read STORED_AGENTS_FEATURE.md in the repo root for full feature context.
</background>

<setup>
1. Read STORED_AGENTS_FEATURE.md for full feature context
2. Read packages/core/src/storage/types.ts for StorageAgentType (thin), StorageAgentSnapshotType, StorageResolvedAgentType
3. Read packages/core/src/mastra/index.ts -- focus on:
   - getStoredAgentById (around line 781)
   - listStoredAgents (around line 891)
   - #createAgentFromStoredConfig (around line 1021)
   - #resolveStoredTools (around line 1091)
   - #resolveStoredWorkflows, #resolveStoredAgents, #resolveStoredMemory, #resolveStoredScorers
   - #storedAgentsCache and clearStoredAgentCache
4. Read client-sdks/client-js/src/types.ts -- focus on StoredAgentResponse (around line 607), CreateStoredAgentParams, UpdateStoredAgentParams, ListStoredAgentsResponse, AgentVersionResponse
5. Read client-sdks/client-js/src/resources/stored-agent.ts
6. Read packages/core/src/mastra/stored-agents.test.ts if it exists
</setup>

<tasks>
1. Update getStoredAgentById in packages/core/src/mastra/index.ts: The storage layer now returns a resolved agent (merged metadata + version config) from getAgentByIdResolved. Update this method to work with the StorageResolvedAgentType. When raw is requested, return the resolved type. When non-raw, pass the resolved data to createAgentFromStoredConfig.

2. For version-specific requests (versionId or versionNumber params): Fetch the specific version (which has config fields directly on the row, not in a nested snapshot), then merge its config with the agent metadata to produce a StorageResolvedAgentType before passing to createAgentFromStoredConfig.

3. Update #createAgentFromStoredConfig: Change the parameter type from StorageAgentType to StorageResolvedAgentType (or whatever combined type was created in Command 1). The method extracts name from the version config portion, model config from the version, and resolves tools/workflows/agents/memory/scorers from the version config. The agent id comes from the agent record portion.

4. Update #resolveStoredMemory: The memory field is now Record<string, unknown> (an object config) instead of a string key. Update the resolution logic accordingly. The object may contain a key or identifier field that maps to a registered memory instance, plus additional configuration. Inspect how memory instances are currently registered in Mastra to determine the right lookup approach.

5. Update listStoredAgents: Use listAgentsResolved from the storage layer which now returns StorageResolvedAgentType objects. Pass each to createAgentFromStoredConfig.

6. Update the #storedAgentsCache: The cache key is the agent id. Ensure the cache still works correctly with the new types. Cache invalidation via clearStoredAgentCache should remain the same.

7. In client-sdks/client-js/src/types.ts, update StoredAgentResponse: Add activeVersionId (optional string) and status (string). Keep all config fields in the response type (name, description, instructions, model, tools, etc.) since the API returns resolved/merged data. Change memory from string to Record<string, unknown>.

8. Update CreateStoredAgentParams: Should include agent metadata (id, authorId, metadata) plus initial config fields (name, instructions, model, etc.). Change memory type to Record<string, unknown>.

9. Update UpdateStoredAgentParams: All fields optional. Include both metadata fields and config fields. Change memory type to Record<string, unknown>.

10. Review StoredAgent resource class in client-sdks/client-js/src/resources/stored-agent.ts: Ensure the method signatures and HTTP calls still match the updated server API. The endpoints themselves have not changed, only the request/response shapes.

11. Update any existing tests in packages/core/src/mastra/stored-agents.test.ts to use the new types and verify:
    - getStoredAgentById returns an Agent instance built from resolved data
    - The raw option returns StorageResolvedAgentType
    - Version-specific requests work
    - listStoredAgents returns Agent instances from resolved data

12. Do a final check: search for any remaining references to the old StorageAgentType shape (where config fields like instructions or model are accessed directly on an agent record without version resolution). Fix any missed references.
</tasks>

<testing>
1. Run pnpm build:core to verify core compiles cleanly
2. Build the client SDK package
3. Run stored agent tests in packages/core/src/mastra/stored-agents.test.ts
4. Run a full build from the repo root (pnpm build) to catch any remaining type errors across the monorepo
5. Search the codebase for any remaining references to the old field layout that might have been missed
</testing>

Output <promise>COMPLETE</promise> when all tasks are done.
