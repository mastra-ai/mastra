# Documentation Updates Needed for Composite Storage PR

Based on the changes in the `composite-storage-time` branch, here are the documentation updates needed:

## Summary of Changes

1. **Composite Storage** - Added ability to use a `default` store with domain-specific overrides via `stores` parameter
2. **Storage Domains** - Storage is now organized into domains (workflows, memory, evals, observability)
3. **getStore() method** - New method to access domain-specific stores, falls back to default store
4. **API Changes** - All storage operations now go through domain stores (e.g., `memoryStore.listMessages()` instead of `storage.listMessages()`)

## Files Already Updated ✅

1. `docs/src/content/en/docs/server-db/storage.mdx` - ✅ Updated with composite storage examples, domain-based API, and Storage Domains section content
2. `docs/src/content/en/reference/core/getStorage.mdx` - ✅ Updated with getStore() information
3. `docs/src/content/en/reference/core/getStore.mdx` - ✅ Created with method signature, parameters, return type, fallback behavior, and examples for each domain
4. `examples/` directory - ✅ Verified: No direct storage API usage found, examples use high-level APIs correctly, composite-storage example demonstrates correct pattern
5. Storage adapter READMEs - ✅ Updated all storage adapter READMEs to minimal setup guides with links to documentation:
   - `stores/lance/README.md`
   - `stores/pg/README.md`
   - `stores/libsql/README.md`
   - `stores/mongodb/README.md`
   - `stores/dynamodb/README.md`
   - `stores/upstash/README.md`
   - `stores/cloudflare/README.md`
   - `stores/clickhouse/README.md`
   - `stores/mssql/README.md`
   - `stores/cloudflare-d1/README.md`

## Files That Need Updates ❌

### 1. Migration Guide - Storage API Changes (HIGH PRIORITY)

**File:** `docs/src/content/en/guides/migrations/upgrade-to-v1/storage.mdx`

**Issues Found:**

- Lines 39-45: Shows `storage.listMessages()` directly (should use `getStore('memory')`)
- Lines 57-71: Shows `storage.listMessages()` directly in `getMessagesPaginated` migration (should use `getStore('memory')`)
- Lines 171-173: Shows `storage.saveMessages()` directly (should use `getStore('memory')`)
- Lines 308-315: Shows `storage.listMessages()` directly in non-paginated functions section (should use `getStore('memory')`)
- Lines 116: Shows `storage.listWorkflowRuns()` directly (should use `getStore('workflows')`)
- Lines 324-325: Shows `storage.getTraces()` directly (should use `getStore('observability')`)

**Required Updates:**

## Detailed Changes Checklist

### Memory Domain Operations

- [ ] Line 39-45: `storage.listMessages()` → `memoryStore.listMessages()` (pagination example)
- [ ] Line 57-71: `storage.listMessages()` → `memoryStore.listMessages()` (getMessagesPaginated migration)
- [ ] Line 171-173: `storage.saveMessages()` → `memoryStore.saveMessages()`
- [ ] Line 308-315: `storage.listMessages()` → `memoryStore.listMessages()` (non-paginated section)

### Workflows Domain Operations

- [ ] Line 116: `storage.listWorkflowRuns()` → `workflowsStore.listWorkflowRuns()`
- [ ] Add new section: Workflow snapshot methods changed
  - [ ] `persistWorkflowSnapshot` → `createWorkflowSnapshot`
  - [ ] `loadWorkflowSnapshot` → `getWorkflowSnapshot`
  - [ ] `workflowName` parameter → `workflowId` parameter
  - [ ] Show example using `getStore('workflows')`

### Evals Domain Operations

- [ ] Line 288-292: `storage.getScores()` → `evalsStore.listScoresByScorerId()`

### Observability Domain Operations

- [ ] Line 324-325: Update `getTraces` removal section
  - [ ] Show migration to `observabilityStore.getTrace()` / `observabilityStore.listTraces()`
  - [ ] Update example to use `getStore('observability')` instead of just observability package

## Testing Checklist

After making updates, verify:

- [ ] Migration guide examples show correct patterns
- [ ] Storage reference pages are consistent
- [ ] All code examples compile
- [ ] Composite storage examples are clear

```

```
