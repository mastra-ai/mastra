# PR #17224 — Follow-ups

Items surfaced during review that should be addressed before merge or as a fast-follow.
Cross-references: `.notes/pr-17224-qa.md` (review Q&A), `.notes/pr-17224-review-guide.md` (review order).

---

## Open

### FU-1: `cursor`-based pagination on connections — flip to Mastra-standard `{ page, perPage }` across all layers

**Severity:** medium — API consistency issue
**Status:** in progress — pending manual smoke test (worktree dirty; backend/frontend commits not yet split)
**Discovered:** Q4 in `.notes/pr-17224-qa.md` (scope expanded after auditing server schema layer)

**Problem**
The cursor pattern leaks across **four layers**, not just core:

**1. Core types** (`packages/core/src/tool-provider/types.ts:317-350`)
```ts
ListConnectionsOpts  { toolkit, userIds?, userId?, cursor?, limit? }
ListConnectionsResult { items, nextCursor? }
```

**2. Server query schema** (`packages/server/src/server/schemas/tool-providers.ts:103-114`)
```ts
export const listConnectionsQuerySchema = z.object({
  toolkit, authorId?, scope?,
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});
```

**3. Server response schema** (`packages/server/src/server/schemas/tool-providers.ts:232-246`)
```ts
export const listConnectionsResponseSchema = z.object({
  items: z.array(...),
  nextCursor: z.string().optional(),
});
```

**4. Generated artifacts** — `route-types.generated.ts` and `route-metadata.generated.ts` pick up both `cursor` query param and `nextCursor` response field

**Convention** — every other list API in core uses `{ pagination: { page, perPage, hasMore } }`:
- datasets, experiments, observability, logger, memory, scores
- **even within the same PR**: `ListToolProviderToolsOptions` (line 51), `ListToolkitsV2Opts` (line 207), `ToolProviderListResult<T>` (line 65), and `listToolProviderToolsQuerySchema` in the **same schema file** uses `page` + `perPage`

`cursor` was mirrored from Composio's SDK response shape (`nextCursor`) but breaks Mastra convention — and crucially, this is the **only route in `packages/server/src/server/schemas/tool-providers.ts`** that uses cursor. The sibling `listToolProviderToolsQuerySchema` already uses `page` + `perPage`.

**Recommended change — across all 4 layers**

```ts
// Core types
ListConnectionsOpts  { toolkit, userIds?, userId?, page?, perPage? }
ListConnectionsResult { items, pagination: { total?, page, perPage, hasMore } }

// Server query schema
listConnectionsQuerySchema = z.object({
  toolkit, authorId?, scope?,
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(200).optional(),
});

// Server response schema
listConnectionsResponseSchema = z.object({
  items: z.array(...),
  pagination: z.object({ page, perPage, hasMore, total: z.number().optional() }),
});
```

**Files to change**
- `packages/core/src/tool-provider/types.ts:317-350` — flip `ListConnectionsOpts` + `ListConnectionsResult` types
- `packages/server/src/server/schemas/tool-providers.ts:103-114` — flip `listConnectionsQuerySchema` (drop `cursor`/`limit`, add `page`/`perPage`)
- `packages/server/src/server/schemas/tool-providers.ts:232-246` — flip `listConnectionsResponseSchema` (drop `nextCursor`, add `pagination`)
- `packages/server/src/server/handlers/tool-providers.ts` LIST_CONNECTIONS handler — pass page/perPage to provider; emit pagination envelope
- `packages/editor/src/providers/composio.ts:330-356` — use `composio.connectedAccounts.list({ page, limit })` (SDK 0.6.x supports `page`); map response to pagination envelope
- `client-sdks/client-js/src/resources/tool-provider.ts` `listConnections()` — signature flip (params `{ page, perPage }`, response `{ items, pagination }`)
- `client-sdks/client-js/src/types.ts` — `ListToolProviderConnectionsParams` / `ListToolProviderConnectionsResponse` types
- Regenerate `route-types.generated.ts`, `route-metadata.generated.ts` (via `pnpm --filter ./packages/server generate:permissions` and route-types pipeline)
- `packages/playground/src/domains/tool-providers/hooks/use-existing-connections.ts` — caller (UI doesn't paginate yet, so no UX break)
- `packages/playground/src/domains/tool-providers/hooks/use-all-connections.ts` — same

**Verification**
- `pnpm test:core` (types)
- `pnpm test:server` (handler + schema)
- `pnpm --filter ./packages/server check:permissions`
- `pnpm --filter ./packages/playground test` (MSW handlers may need updates if any tests stub `nextCursor`)

**Effort:** small (≈ 1-2h, mechanical across 4 layers)

---

### FU-2: Decide whether to rename `mastra_tool_provider_connections` table before release

**Severity:** low — naming consistency, but irreversible after ship
**Status:** open
**Discovered:** Q6 in `.notes/pr-17224-qa.md`

**Problem**
`mastra_tool_provider_connections` is the longest table name in `packages/core/src/storage/constants.ts`. It's accurate but verbose. Once shipped, renaming requires a storage migration in every adapter (libsql, clickhouse, cloudflare KV, postgres) plus any production data.

**Options**
- Keep `mastra_tool_provider_connections` (accurate, matches `mastra_channel_installations` precedent)
- Rename to `mastra_tp_connections` (compact but loses readability)
- Rename to `mastra_integration_connections` — conflicts with legacy v1 `integrationTools` concept

**Recommended**
Keep as-is, **but lock it in before release**. Add a unit test that asserts the table name string is stable to discourage future drift.

**Effort:** zero if kept; high if renamed post-ship (migration across all adapters)

---

### FU-3: Rename generic CRUD methods on `ToolProviderConnectionsStorage` to match house style

**Severity:** low — API consistency
**Status:** in progress — pending manual smoke test (worktree dirty; backend/frontend commits not yet split)
**Discovered:** Q8 in `.notes/pr-17224-qa.md` (sharpened after surveying all storage domains)

**Problem**
`packages/core/src/storage/domains/tool-provider-connections/base.ts` uses bare CRUD methods (`get`, `upsert`, `list`, `delete`). Almost every other storage domain in core uses the `verb-Entity[-By-key]` pattern:

- `getDatasetById`, `listDatasets`, `createDataset`, `deleteDataset`
- `getExperimentById`, `listExperiments`, `addExperimentResult`, `listExperimentResults`
- `createSchedule`, `listSchedules`, `listDueSchedules`, `recordTrigger`, `listTriggers`
- `getScoreById`, `saveScore`, `listScoresByScorerId`, `listScoresByRunId`, `listScoresByEntityId`
- `saveInstallation`, `getInstallationByAgent`, `getInstallationByWebhookId`, `listInstallations`
- `favorite`, `unfavorite`, `isFavorited`, `listFavoritedIds`, `deleteFavoritesForEntity`
- `getRunningCount`, `getRunningCountByAgent`

The only sibling with bare CRUD is `blobs/base.ts` (`put`, `get`, `has`) — and that's because a blob store is genuinely a generic content-addressable bag. Tool-provider connections are a domain entity with clear ownership semantics, not blobs.

**Recommended rename**
```
get(key)        → getConnectionById(args)           # matches getDatasetById, getScoreById, getExperimentById
upsert(input)   → upsertConnection(input)          # keep "upsert" verb — honest about idempotency
list(input)     → listConnectionsByAuthor(args)    # matches listScoresByRunId, getRunningCountByAgent
delete(input)   → deleteConnection(input)          # matches deleteDataset, deleteSchedule, deleteTask
dangerouslyClearAll() → keep
```

**Why `listConnectionsByAuthor` (not just `listConnections`)**
The `authorId` filter is the security-critical invariant of this domain — every read scopes to one bucket. Encoding it in the method name makes the security intent grep-able and matches the precedent set by `listScoresByRunId`, `listScoresByEntityId`, etc.

**Files**
- `packages/core/src/storage/domains/tool-provider-connections/base.ts`
- `packages/core/src/storage/domains/tool-provider-connections/inmemory.ts` + `inmemory.test.ts`
- `stores/libsql/src/storage/domains/tool-provider-connections/index.ts` + `index.test.ts`
- `packages/server/src/server/handlers/tool-providers.ts` (5 call sites: lines 271, 396, 541, 618, 682)
- `packages/server/src/server/handlers/tool-providers.test.ts`

**Effort:** small (≈ 45 min, mechanical)

---

### FU-4: Document Agent Builder custom model / gateway override

**Severity:** low — docs gap (out of PR scope but worth tracking)
**Status:** open
**Discovered:** Q9 in `.notes/pr-17224-qa.md`

**Problem**
`createBuilderAgent(args?)` accepts a `model` override (and any other `Agent` constructor args), so Builder can run on a custom gateway like `azure-openai/...` or a user-defined `MastraModelGateway`. Agent Builder docs don't mention this — `docs/agent-builder/overview.mdx` only says `OPENAI_API_KEY` is required.

**Recommended doc additions**
- Short "Using a custom model" subsection in `docs/agent-builder/overview.mdx`
- Snippet showing `createBuilderAgent({ model: 'azure-openai/gpt-4o-deployment' })` and the registered-gateway pattern
- Note the tool-calling requirement (Builder drives `set-agent-tools` etc., so the model must support function calling)

**Out of scope for PR #17224** — but worth a follow-up doc PR. Not blocking.

**Effort:** small (≈ 20 min)

---

### FU-5: Rename `V2`-suffixed ToolProvider methods to `VNext` — must land before GA

**Severity:** medium — public interface naming, gets harder to change after release
**Status:** in progress — pending manual smoke test (worktree dirty; backend/frontend commits not yet split)
**Discovered:** review discussion on `BaseToolProvider` method naming

**Problem**
`ToolProvider` interface and `BaseToolProvider` abstract class expose v2 methods with `V2` suffix:

```ts
listToolkitsV2(): Promise<ListToolkitsResult>
listToolsV2(opts?): Promise<ListToolsResult>
resolveToolsV2(opts: ResolveToolsOpts): Promise<Record<string, ToolAction>>
```

`V2` is **deployment-history leakage** — it tells future readers nothing about what the method does. It also commits us to `V3` when the surface evolves again.

**Codebase audit — `V2` vs `VNext` precedent**

`V2` in core (71 hits) breaks down into:
- **Re-exports from AI SDK v2** (`LanguageModelV2*`, `EmbeddingModelV2`, `SharedV2ProviderMetadata`) — forced by upstream, not our convention
- **Adapters wrapping AI SDK v2** (`MastraLanguageModelV2`, `isV2Model`, `applyStrictForV2`) — symmetry with upstream
- **Internal type lineage bridges** (`MastraMessageV1` ↔ `MastraMessageV2` ↔ canonical `MastraDBMessage`) — transitional shapes for legacy data
- **`listToolkitsV2` / `listToolsV2` / `resolveToolsV2`** — the **only method-level `V2` on a new core primitive** with no AI SDK lineage. **Outlier.**

`VNext` in core (71 hits) is the established convention for **"new shape of our own primitive that coexists with the old shape long-term"**:
- `MastraLLMVNext` (llm/model/model.loop.ts)
- `loggerVNext`, `getLoggerVNext`, `resolveLoggerVNext`, `setLoggerVNext` (logger/dual-logger.ts)
- `useVNext` boolean opt-in (memory.ts, processors/memory/working-memory.ts)
- `isVNext` flag + `format: 'legacy' | 'vnext'` string (workflows/workflow.ts)
- `__experimental_updateWorkingMemoryVNext`, `getWorkingMemoryToolInstructionVNext` (memory)

ToolProvider falls squarely in the `VNext` use case, not the `V2` use case.

**Recommended rename**
```ts
listToolkitsV2  → listToolkitsVNext
listToolsV2     → listToolsVNext
resolveToolsV2  → resolveToolsVNext
```

Plus all references in JSDoc, allowlist comments, runtime checks, and the legacy-surface block comment.

**Files to change**

*Core (interface + base class + runtime resolver):*
- `packages/core/src/tool-provider/types.ts` — interface members + JSDoc (lines 197, 211, 224, 230, 356-357, 359, 374, 409-426)
- `packages/core/src/tool-provider/base.ts` — abstract method names + JSDoc + block comments (lines 37, 67, 69, 76, 102, 105, 110, 115-116, 124, 140)
- `packages/core/src/tool-provider/runtime.ts` — `resolveToolsV2` references (lines 13, 56, 92-93, 143)

*Editor (concrete provider implementation):*
- `packages/editor/src/providers/composio.ts` — `resolveToolsV2` impl rename (line 164) + JSDoc reference (line 43)
- `packages/editor/src/providers/composio.test.ts` — 12 references across `listToolkitsV2` (lines 86, 93, 101) and `resolveToolsV2` (lines 192, 204, 215, 239, 244, 256, 261, 274, 279)
- `packages/editor/src/providers/arcade.ts` — currently bare `implements ToolProvider` (v1 only, no `V2` methods). When Arcade migrates to v2, it ships under `VNext` names directly. No rename needed today, but flag for the Arcade-v2 migration follow-up

*Server (fallback shims):*
- `packages/server/src/server/handlers/tool-providers.ts` — fallback checks (lines 138-139, 174-175)
- `packages/server/src/server/handlers/tool-providers.test.ts` — any tests referencing `*V2` method names

*No changes needed:*
- Client SDK (`client-sdks/client-js/src/resources/tool-provider.ts`) — does not expose method-level V2 names; talks HTTP only
- Generated artifacts (`route-types.generated.ts`, `route-metadata.generated.ts`) — derived from route paths, not method names

**Breaking change?**
- For **callers**: no — legacy `listToolkits` / `listTools` / `resolveTools` methods stay in place; only the new methods are renamed
- For **external implementers**: yes — third-party `extends BaseToolProvider` or `implements ToolProvider` code that declared `resolveToolsV2` etc. must rename. Audience is currently zero (v2 surface ships in this PR), so the cost window is now
- **Must land before this PR ships to npm.** After release, the rename becomes a real breaking change requiring deprecation cycle.

**Why not the deprecation-shim pattern (`*Legacy` suffix on old methods, clean names on new)?**
- Strongest API surface long-term, but couples the rename to a sweep of every v1 caller
- Best done in a separate cleanup once `VNext` has stabilized (mirroring the `MastraMessageV1` → `MastraMessageV2` → `MastraDBMessage` arc)
- For this PR: ship as `VNext`, defer canonical-name consolidation

**Effort:** small (≈ 30 min, mechanical rename + 1 round of typecheck/tests)

---

<!-- New follow-ups appended below as conversation continues. -->
