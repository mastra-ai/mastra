# PR #17224 Review Guide — v1 ToolProvider Backend

**Branch:** `yj/v1-tool-provider-backend` → `main`
**Size:** ~7.8k additions / 256 deletions across 44 files
**Strategy:** Review in **layers** bottom-up (types → storage → runtime → server → SDK → editor). Skip generated files.

---

## 1. Domain contracts (10 min) — start here

- [ ] `packages/core/src/tool-provider/types.ts` (+352) — `ToolProvider` v1+v2 interface, `ToolProviderCapabilities`, `ToolProviderConnectionScope` union, `SHARED_BUCKET_ID`
- [ ] `packages/core/src/tool-provider/errors.ts` (+28) — `UnknownToolProviderError`
- [ ] `packages/core/src/storage/types.ts` (+106) — `StorageToolProviderConnection`, `StorageUpsertToolProviderConnectionInput`
- [ ] `packages/core/src/storage/constants.ts` (+30) — new domain constants

**Look for:**
- Scope enum coverage (`per-author` / `shared` / `caller-supplied`)
- Label nullability
- Immutable fields on `upsert` (toolkit, scope, connectionId should not change)

---

## 2. Storage layer (10 min)

- [ ] `packages/core/src/storage/domains/tool-provider-connections/base.ts` (+61) — abstract methods (`get`, `upsert`, `list`, `delete`)
- [ ] `packages/core/src/storage/domains/tool-provider-connections/inmemory.ts` (+85)
- [ ] `packages/core/src/storage/domains/tool-provider-connections/inmemory.test.ts` (+277) — read tests first to understand semantics
- [ ] `stores/libsql/src/storage/domains/tool-provider-connections/index.ts` (+222) + `index.test.ts` (+279)

**Look for:**
- `(authorId, providerId, connectionId)` composite index
- Row-level `authorId` filter on every read
- `upsert` idempotency on the composite key
- Label round-trip (write null, read null; write string, read same string)

---

## 3. Runtime resolution (15 min) — the brain

- [ ] `packages/core/src/tool-provider/runtime.ts` (+212) — `resolveStoredToolProviders` fan-out, `resolveConnectionAuthorId` scope→bucket logic
- [ ] `packages/core/src/tool-provider/base.ts` (+180) — `BaseToolProvider`, default `resolveToolsV2`
- [ ] `packages/core/src/tool-provider/runtime.test.ts` (+93)

**Look for:**
- Multi-connection suffix-renaming (`tool__label` shape)
- Silent skip behavior on missing/empty connections (intentional — debug-level logger.debug calls)
- Scope→bucket mapping: `per-author` → caller authorId; `shared` → `SHARED_BUCKET_ID`; `caller-supplied` → runtime resourceId
- Unknown providerId throws `UnknownToolProviderError`

---

## 4. Server handlers (20 min) — the auth gate

- [ ] `packages/server/src/server/schemas/tool-providers.ts` (+221) — zod schemas
- [ ] `packages/server/src/server/handlers/tool-providers.ts` (+680) — 12 routes: AUTHORIZE, LIST_CONNECTIONS, DISCONNECT, etc.
- [ ] `packages/server/src/server/handlers/tool-providers.test.ts` (+1613) — read test names first, then deep-dive any 403/404 paths
- [ ] `packages/server/src/server/server-adapter/routes/tool-providers.ts` (+19) — route wiring

**Look for:**
- Ownership gate: `connection.authorId === caller.authorId` enforced everywhere
- 403 for non-owners on GET/UPDATE/DELETE
- Admin bypass via `tool-providers:admin` permission
- `caller-supplied` scope **never** enumerated for non-admins
- Shared bucket visibility rules (LIST includes shared if any exist)
- LIST filter: `userIds = [callerAuthorId]` (+ `SHARED_BUCKET_ID` if shared rows exist)

---

## 5. Editor integration (10 min) — Composio path

- [ ] `packages/editor/src/providers/composio.ts` (+440/-89) — full v2 surface, `resolveToolsV2` with `connectedAccountId` injection
- [ ] `packages/editor/src/providers/composio.test.ts` (+680)
- [ ] `packages/editor/src/namespaces/agent.ts` (+39) — `toolProvidersFragment` merge into `createAgentFromStoredConfig`
- [ ] `packages/editor/src/editor-integration-tools.test.ts` (+96)

**Look for:**
- `beforeExecute` injects `connectedAccountId` per-call
- `internalUserId` hashing (`mapUserToResourceId`)
- `link()` vs `initiate()` choice — currently pinned to 0.6.5, uses `initiate` (see `.notes/composio-sdk-pinned-0.6.5.md`)
- `toolProvidersFragment` merge happens after static tools, before workflow exposure

---

## 6. Client SDK surface (5 min) — public API

- [ ] `client-sdks/client-js/src/resources/tool-provider.ts` (+161) — v2 methods (`authorize`, `getAuthStatus`, `listConnections`, `disconnectConnection`, etc.)
- [ ] `client-sdks/client-js/src/resources/tool-provider.test.ts` (+217)
- [ ] `client-sdks/client-js/src/types.ts` (+109) — exported param/response types

**Look for:**
- Method signatures match server routes
- No leaked internal types (everything inferred from `Body<...>` / `GeneratedResponse<...>`)

---

## 7. Glance only

- [ ] `.changeset/v1-tool-provider-backend.md` — version bumps + description
- [ ] `.notes/composio-sdk-pinned-0.6.5.md` — context for Composio pin
- [ ] `packages/server/src/server/handlers/stored-agents.{ts,test.ts}` — small drift, check it's just `toolProviders` field plumbing

---

## Skip (generated / mechanical)

- `client-sdks/client-js/src/route-types.generated.ts` (+1219)
- `packages/cli/src/commands/api/route-metadata.generated.ts` (+159)
- `packages/core/src/auth/ee/interfaces/permissions.generated.ts` (+10)
- `packages/core/src/storage/mock.ts` (+2)
- `packages/core/src/storage/domains/inmemory-db.ts` (+7)
- `packages/core/src/storage/domains/operations/inmemory.ts` (+1)
- `packages/core/src/storage/domains/index.ts` (+1)
- `packages/core/src/editor/types.ts` (+6)
- `packages/core/src/storage/base.ts` (+4)
- `packages/core/src/storage/domains/agents/filesystem.ts` (+1)
- `stores/clickhouse/src/storage/db/utils.ts` (+2)
- `stores/cloudflare/src/kv/storage/types.ts` (+3)
- `stores/libsql/src/storage/index.ts` (+4)

---

## Key invariants to verify

- Connections are **private by default** (`per-author` scope, `authorId` filter on every storage op)
- Non-owner LIST/GET/UPDATE/DELETE returns 403 unless `tool-providers:admin`
- `SHARED_BUCKET_ID = 'shared'` for shared scope; never collides with real authorIds
- Runtime resolution silently skips toolkits with no usable connections (matches MVP UX — debug logs only)
- Composio still pinned to 0.6.5 (see `.notes/composio-sdk-pinned-0.6.5.md` for why)

---

## Test commands

```bash
# Focused
pnpm --filter ./packages/core test -- tool-provider
pnpm --filter ./packages/server test -- tool-providers
pnpm --filter ./packages/editor test -- composio
pnpm --filter ./packages/client-js test -- tool-provider
pnpm --filter ./stores/libsql test -- tool-provider-connections

# Full sweep
pnpm build:core && pnpm test:core
pnpm --filter ./packages/server build && pnpm --filter ./packages/server test
```
