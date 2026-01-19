# Merge from Main Plan

## Overview

The `obs-mem` branch has diverged significantly from `main`:
- **192 commits ahead** of main
- **681 commits behind** main (as of analysis)
- **Total divergence: ~870 commits**

This document outlines a careful, manual merge strategy to incorporate main's changes without breaking Observational Memory (OM) functionality.

## Key Commits on Main Affecting OM

### 1. `dee388dde0` - Storage API Refactor (HIGH IMPACT)
**Replaces passthrough methods with domain-specific `getStore()` pattern**

- Removes ~3000 lines of duplicated code from storage adapters
- All storage operations now go through `storage.getStore('domain')`
- **Migration pattern:**
  ```typescript
  // Before (obs-mem style)
  const thread = await storage.getThreadById({ threadId });
  
  // After (main style)
  const memory = await storage.getStore('memory');
  const thread = await memory?.getThreadById({ threadId });
  ```
- Affects ALL storage adapters (pg, libsql, mongodb, dynamodb, etc.)
- **57 files changed**

### 2. `27c0009777` - StorageDomain Base Class (HIGH IMPACT)
**Introduces `StorageDomain` base class for all domain stores**

- `MemoryStorage` now extends `StorageDomain` (not `MastraBase` directly)
- `StorageDomain` adds:
  - `async init(): Promise<void>` - for table/collection creation
  - `abstract dangerouslyClearAll(): Promise<void>` - for testing
- Moves domain operations files (e.g., `domains/operations` → `db`)
- Creates shared `inmemory-db.ts` for in-memory adapters
- **127 files changed**

### 3. `3bf6c5f104` - Enhanced Processor System (MEDIUM IMPACT)
**Adds retry, workflow orchestration, tripwire improvements**

- OM uses processors - need to verify compatibility
- New processor features may benefit OM
- **60+ files changed**

### 4. `4ca430614d` - `processInputStep` Expansion (MEDIUM IMPACT)
**Expands `processInputStep` with more context**

- OM's `processInputStep` may need updates to match new signature
- Need to verify our processor still works with enhanced system

### 5. `8538a0d232` - MessageHistory `resourceId` (LOW IMPACT)
**MessageHistory input processor passes resourceId for storage**

- May benefit OM's resource-scoped operations
- Generally compatible with our changes

## Detailed Conflict Analysis

### `packages/core/src/storage/domains/memory/base.ts`

| Aspect | Main | obs-mem | Resolution |
|--------|------|---------|------------|
| Base class | `StorageDomain` | `MastraBase` | **Use main's** `StorageDomain` |
| Thread cloning | `cloneThread()` method | None | **Add from main** |
| OM methods | None | 15 methods | **Add our methods** |
| `deleteMessages` | Different signature? | Our signature | **Verify & merge** |
| Date range filters | `startExclusive`/`endExclusive` | None | **Add from main** |

### `packages/core/src/storage/types.ts`

| Aspect | Main | obs-mem | Resolution |
|--------|------|---------|------------|
| OM types | None | 5 interfaces | **Add our types** |
| `StorageListMessagesInput` | Has exclusive flags | Doesn't | **Use main's + add our fields** |
| Column types | Extracted to `StorageColumnType` | Inline | **Use main's** |
| Clone types | `StorageCloneThreadInput/Output` | None | **Add from main** |

### `packages/core/src/storage/domains/memory/inmemory.ts`

| Aspect | Main | obs-mem | Resolution |
|--------|------|---------|------------|
| Base class | `StorageDomain` | `MastraBase` | **Use main's** |
| Shared DB | Uses `inmemory-db.ts` | Self-contained | **Adapt to main's pattern** |
| OM implementation | None | Full (lines 610-881) | **Add our implementation** |
| Thread cloning | Implemented | None | **Keep main's** |

### `packages/memory/src/index.ts`

| Aspect | Main | obs-mem | Resolution |
|--------|------|---------|------------|
| Storage access | `getStore('memory')` | Direct methods | **Use main's pattern** |
| Mutex import | Has `async-mutex` | ? | **Keep main's** |
| Clone support | Has clone methods | ? | **Keep main's** |

## Pre-Merge Checklist

- [ ] Ensure all local changes are committed
- [ ] Ensure all LongMemEval benchmark runs are complete (no background processes)
- [ ] Create a backup branch: `git branch obs-mem-backup-$(date +%Y%m%d)`
- [ ] Verify tests pass on current branch: `pnpm test --filter=@mastra/memory`

## Risk Assessment

### High-Risk Areas (Manual Review Required)

| Area | Risk | Reason |
|------|------|--------|
| `packages/core/src/storage/` | 🔴 HIGH | OM adds 15 new methods to `MemoryStorage` base class |
| `packages/core/src/memory/` | 🔴 HIGH | Thread/message types may have changed |
| `packages/memory/` | 🟡 MEDIUM | Our primary development area |
| `stores/*/src/storage/domains/memory/` | 🟡 MEDIUM | May have interface changes |
| `packages/core/src/agent/` | 🟡 MEDIUM | Agent integration points |

### Low-Risk Areas

| Area | Risk | Reason |
|------|------|--------|
| `explorations/longmemeval/` | 🟢 LOW | Only exists on our branch |
| `packages/memory/src/experiments/` | 🟢 LOW | Only exists on our branch |
| Documentation, examples | 🟢 LOW | Unlikely to conflict |

## Merge Strategy

### Step 1: Fetch and Analyze

```bash
# Fetch latest main
git fetch origin main

# See what files have conflicts
git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main | grep -A3 "CONFLICT"

# List files changed in both branches
git diff --name-only $(git merge-base HEAD origin/main) HEAD > our-changes.txt
git diff --name-only $(git merge-base HEAD origin/main) origin/main > main-changes.txt
comm -12 <(sort our-changes.txt) <(sort main-changes.txt) > potential-conflicts.txt
```

### Step 2: Review Main's Changes to Critical Files

Before merging, review what main changed in our critical areas:

```bash
# Storage base class changes
git diff $(git merge-base HEAD origin/main) origin/main -- packages/core/src/storage/domains/memory/base.ts

# Storage types changes
git diff $(git merge-base HEAD origin/main) origin/main -- packages/core/src/storage/types.ts

# Memory types changes
git diff $(git merge-base HEAD origin/main) origin/main -- packages/core/src/memory/types.ts

# InMemoryMemory changes
git diff $(git merge-base HEAD origin/main) origin/main -- packages/core/src/storage/domains/memory/inmemory.ts
```

### Step 3: Merge with Manual Resolution

```bash
# Start the merge (DO NOT use --no-commit to see conflicts first)
git merge origin/main

# If conflicts, resolve each file manually
# For each conflict:
# 1. Open the file
# 2. Understand BOTH changes
# 3. Combine them correctly (don't just pick one side)
# 4. Test the combined result
```

### Step 4: Conflict Resolution Guidelines

#### For `packages/core/src/storage/domains/memory/base.ts`

**Our additions (KEEP):**
- All `async getObservationalMemory()` methods
- All `async initializeObservationalMemory()` methods
- All other OM-related methods (15 total)
- `ObservationalMemoryRecord` type imports

**Main's changes (INTEGRATE):**
- Any new non-OM methods
- Any signature changes to existing methods (update our code to match)
- Any new imports

#### For `packages/core/src/storage/types.ts`

**Our additions (KEEP):**
- `ObservationalMemoryRecord` interface
- `CreateObservationalMemoryInput` interface
- `UpdateActiveObservationsInput` interface
- `UpdateBufferedObservationsInput` interface
- `CreateReflectionGenerationInput` interface

**Main's changes (INTEGRATE):**
- Any new types
- Any changes to `StorageThreadType` (update our code if needed)
- Any changes to `MastraDBMessage` (update our code if needed)

#### For `packages/core/src/storage/domains/memory/inmemory.ts`

**Our additions (KEEP):**
- All OM method implementations (lines ~610-881)
- `InMemoryObservationalMemory` type
- `getObservationalMemoryKey()` helper

**Main's changes (INTEGRATE):**
- Any new methods
- Any bug fixes to existing methods
- Any performance improvements

### Step 5: Post-Merge Verification

```bash
# 1. Build everything
pnpm build

# 2. Run core tests
pnpm test --filter=@mastra/core

# 3. Run memory tests
pnpm test --filter=@mastra/memory

# 4. Run OM-specific tests
cd packages/memory && pnpm test src/experiments/observational-memory

# 5. Verify LongMemEval still works
cd explorations/longmemeval && pnpm bench om-gpt5-mini -v quick --question-id 07741c45
```

### Step 6: Document Changes

After successful merge, document:
- What conflicts were resolved and how
- Any main changes that affected OM
- Any OM code that needed updating for compatibility

## Rollback Plan

If merge goes wrong:

```bash
# Option 1: Abort during merge
git merge --abort

# Option 2: Reset after commit
git reset --hard obs-mem-backup-$(date +%Y%m%d)

# Option 3: Revert merge commit
git revert -m 1 <merge-commit-hash>
```

## Notes

- OM is NOT a breaking change - methods throw "not implemented" by default
- Storage adapters don't need OM methods until users try to use OM with them
- The `InMemoryMemory` implementation serves as the reference for all adapters
- LongMemEval benchmarks use `PersistableInMemoryMemory` which extends `InMemoryMemory`

## Questions Answered

1. **Has the `MemoryStorage` interface changed in main?**
   - YES: Now extends `StorageDomain` instead of `MastraBase`
   - YES: Added `cloneThread()` method
   - YES: `deleteMessages()` signature may differ
   - YES: `listMessages` input has new `startExclusive`/`endExclusive` flags

2. **Have thread/message types changed?**
   - YES: Added `StorageCloneThreadInput`, `StorageCloneThreadOutput`, `ThreadCloneMetadata`
   - YES: `StorageColumnType` extracted to separate type

3. **Are there any new storage adapters in main?**
   - No new adapters, but all existing ones refactored for `getStore()` pattern

4. **Have any storage adapters been refactored?**
   - YES: MAJOR refactor - all adapters lost passthrough methods
   - YES: Domain-specific stores moved to `db/` directories
   - YES: Operations moved from `domains/operations/` to `db/`

5. **Are there breaking changes in `@mastra/core` we need to handle?**
   - YES: Storage access pattern changed (`getStore('memory')`)
   - YES: Processor system enhanced (verify compatibility)
   - YES: `MastraBase` → `StorageDomain` for all storage domains

## Merge Execution Checklist

### Phase 1: Preparation
- [ ] Create backup branch
- [ ] Verify all OM tests pass
- [ ] List all files that will conflict

### Phase 2: Merge
- [ ] Run `git merge origin/main`
- [ ] Resolve `packages/core/src/storage/domains/memory/base.ts`:
  - [ ] Use `StorageDomain` base class
  - [ ] Keep thread cloning from main
  - [ ] Add ALL 15 OM methods
- [ ] Resolve `packages/core/src/storage/types.ts`:
  - [ ] Use main's structure
  - [ ] Add all OM types
- [ ] Resolve `packages/core/src/storage/domains/memory/inmemory.ts`:
  - [ ] Use main's shared DB pattern
  - [ ] Add OM implementation (adapt if needed)
- [ ] Resolve `packages/memory/src/index.ts`:
  - [ ] Use `getStore('memory')` pattern
  - [ ] Verify OM integration still works

### Phase 3: Verification
- [ ] `pnpm build` succeeds
- [ ] `pnpm test --filter=@mastra/core` passes
- [ ] `pnpm test --filter=@mastra/memory` passes
- [ ] OM unit tests pass
- [ ] LongMemEval quick benchmark passes

### Phase 4: Cleanup
- [ ] Remove backup branch if successful
- [ ] Document any OM changes needed for compatibility
- [ ] Update STORAGE_ADAPTER_OM_IMPLEMENTATION_PLAN.md if needed
