# Issue Summary: ClickHouse Thread Metadata JSON Parse Failures

**Issue:** [#11882](https://github.com/mastra-ai/mastra/issues/11882)

## Problem Statement

When the `mastra_threads.metadata` column in ClickHouse stores `NULL` or an empty string (`''`), the `MemoryStorageClickhouse.getThreadById()` method attempts to parse it with `JSON.parse()`, which throws an "Unexpected EOF" error. This error bubbles up as `CLICKHOUSE_STORAGE_GET_THREAD_BY_ID_FAILED` and blocks every subsequent `saveMessages` call for that thread, making the conversation unusable.

### Observed Behavior (Reported Jan 13, 2026)

- Thread ID: `messenger:dcNCbrAK` had its metadata column stored as an empty string `''`
- When `getThreadById()` was called, `JSON.parse('')` threw an error
- The error propagated to `saveMessages` calls, causing `CLICKHOUSE_STORAGE_GET_THREAD_BY_ID_FAILED`
- The thread became permanently unusable for chat operations
- **CRITICAL**: User is on @mastra/clickhouse version **0.15.6 or earlier** (before Nov 5 fix)
- **Error Format Confirms Old Version**: The error format `CLICKHOUSE_STORAGE_GET_THREAD_BY_ID_FAILED` matches the old hardcoded error string used in versions before the fix. Current code uses `createStorageErrorId('CLICKHOUSE', 'GET_THREAD_BY_ID', 'FAILED')` instead.
- User asked for their version: https://github.com/mastra-ai/mastra/issues/11882#issuecomment-2587866896

## Timeline of Changes

1. **Before Nov 5, 2025**: THE ACTUAL BUG
   - Version: @mastra/clickhouse 0.15.6 and earlier
   - Code had UNSAFE JSON.parse:
     ```typescript
     metadata: typeof thread.metadata === 'string' ? JSON.parse(thread.metadata) : thread.metadata;
     ```
   - **This is the bug the user experienced**: If metadata is empty string `''`, JSON.parse throws "Unexpected EOF"
   - Error: `CLICKHOUSE_STORAGE_GET_THREAD_BY_ID_FAILED`
   - Impact: `saveMessages` calls fail because they call `getThreadById` first

2. **Nov 5, 2025**: `serializeMetadata()` and `parseMetadata()` helper functions added
   - Commit: `5e43eafee9e70f40e19d5a6c6c7c255b98db9894`
   - PR: #9708 (fix/9244 clickhouse metadata)
   - Version: @mastra/clickhouse 1.0.0-beta.0 and later
   - Purpose: Fix duplicate thread rows and consolidate metadata serialization logic
   - **App-level protection added** - safely handles empty strings, null, malformed JSON
   - **This should have fixed the user's issue if they upgrade**

3. **Dec 18, 2025**: `DEFAULT '{}'` constraint logic added to table creation
   - Commit: `27c0009777a6073d7631b0eb7b481d94e165b5ca`
   - PR: #11249 (refactor storage with StorageDomain base class)
   - Condition: `def.type === 'text'`
   - **DB-level protection attempted (but see issues below)**

4. **Jan 12, 2026**: Metadata column type changed from TEXT to JSONB
   - Commit: `9ed5c93a8a77538e4f328add3cb67269ca24d957`
   - Issue: Fixes #8978
   - Changed `metadata: { type: 'text', nullable: true }` to `metadata: { type: 'jsonb', nullable: true }`
   - Version: @mastra/core 1.0.0-beta.21+ (current main branch)
   - **This change NOT yet in user's version** (user is on old version from before Nov 5)

5. **Jan 13, 2026 (today)**:
   - Issue #11882 reported (user still on 'text' schema)
   - Another TEXT → JSONB change merged: `eb648a2cc1`
   - Investigation reveals TWO separate bugs

## Understanding the Issue

**User's Actual Problem:**
The user is on @mastra/clickhouse 0.15.6 or earlier, which has the unsafe `JSON.parse()` bug. When their thread had empty string metadata, it crashed. **The fix already exists in beta.0+**, they just need to upgrade.

**However**, we discovered a SECOND bug while investigating:
The DEFAULT constraint that was supposed to prevent empty strings only checks for `type === 'text'`, but we recently changed the schema to `type === 'jsonb'`. This means new deployments won't get the DEFAULT constraint.

## The Two Bugs

### Bug #1: Original Issue (metadata type = 'text')

**Reported by user who is on 'text' schema**

**Question:** Why did DEFAULT '{}' fail even with type='text'?

**Possible causes:**

1. User's table was created BEFORE Dec 18, 2025 (no DEFAULT constraint in schema)
2. Something wrong with the DEFAULT constraint logic even for 'text' type
3. Data was inserted directly into ClickHouse, bypassing Mastra's `serializeMetadata()`

**Status:** NEEDS INVESTIGATION - We need to verify if DEFAULT ever worked with 'text' type

### Bug #2: New Issue (metadata type = 'jsonb')

**Would affect users after Jan 12, 2026 schema change**

**Problem:** The `DEFAULT '{}'` constraint is NEVER applied because:

```typescript
// Condition checks for 'text' but schema now uses 'jsonb'
if (name === 'metadata' && def.type === 'text' && isNullable) {
  constraints.push("DEFAULT '{}'");
}
```

**Status:** CONFIRMED - Our tests proved DEFAULT is not applied with 'jsonb' type

## Root Cause Analysis

### What's Already Working ✅

1. **Helper Functions** (`stores/clickhouse/src/storage/domains/memory/index.ts:31-55`):
   - `serializeMetadata()`: Ensures metadata is always stored as valid JSON (defaults to `'{}'`)
   - `parseMetadata()`: Safely parses metadata with fallback to `{}` for empty/malformed values

2. **Functions Are Being Used** throughout the codebase:
   - `getThreadById()` calls `parseMetadata(thread.metadata)`
   - `saveMessages()` calls `serializeMetadata(thread.metadata)`
   - `saveThread()` calls `serializeMetadata(thread.metadata)`
   - `updateThread()` calls `serializeMetadata(updatedThread.metadata)`

**This means:** Even without DEFAULT constraint, the app-level code prevents crashes!

### The DEFAULT Constraint Bug

**Location:** `stores/clickhouse/src/storage/db/index.ts:131-133`

```typescript
// Current logic - only checks for 'text'
if (name === 'metadata' && def.type === 'text' && isNullable) {
  constraints.push("DEFAULT '{}'");
}
```

**Issue:** Schema changed to 'jsonb' but condition still checks for 'text'

## Solution Implemented

### Fix: Support Both 'text' AND 'jsonb' Types

**File:** `stores/clickhouse/src/storage/db/index.ts:131-135`

```typescript
// Add DEFAULT '{}' for metadata columns to prevent empty string issues
// Support both 'text' and 'jsonb' types for backwards compatibility
if (name === 'metadata' && (def.type === 'text' || def.type === 'jsonb') && isNullable) {
  constraints.push("DEFAULT '{}'");
}
```

**Why this works:**

- Handles users still on 'text' type (backwards compatible)
- Handles users on new 'jsonb' type (forward compatible)
- ClickHouse stores both as `String` type anyway
- Provides DB-level defense-in-depth alongside `parseMetadata()`

## Test Results

### Test Run 1: metadata type='text' (before jsonb change)

- ✅ All 6 metadata tests **PASSED**
- ✅ DEFAULT constraint **WAS applied** (condition matched: `def.type === 'text'`)
- ✅ 206 total tests passed
- Result: **Works correctly with 'text' type**

### Test Run 2: metadata type='jsonb' (after jsonb change, WITHOUT fix)

- ✅ 5 out of 6 metadata tests **PASSED** (parseMetadata protection works!)
- ❌ 1 test **FAILED**: "should apply DEFAULT constraint to metadata column on new tables"
- Error: `expected '' to be '{}'` - DEFAULT constraint was NOT applied
- Result: **Bug confirmed - DEFAULT not applied with 'jsonb'**

### Test Run 3: metadata type='jsonb' (WITH fix applied)

- ✅ **ALL 6 metadata tests PASSED**
- ✅ DEFAULT constraint now **PROPERLY APPLIED** for 'jsonb' type
- ✅ 206 total tests passed
- Result: **Fix works! Both 'text' and 'jsonb' now supported**

## Defense in Depth Approach

**Two Layers of Protection:**

1. **Database Level**: `DEFAULT '{}'` prevents empty strings at insert time
   - Only works for new tables or tables created/recreated after fix
   - Doesn't help with old tables that lack the DEFAULT

2. **Application Level**: `parseMetadata()` handles any bad data
   - Works for ALL tables (old and new)
   - Gracefully handles: empty strings, null, undefined, malformed JSON
   - **This is why the app doesn't crash despite the DEFAULT bug!**

## User Impact Scenarios

### Scenario 1: User with OLD table (created before Dec 18, 2025)

- **Table:** No `DEFAULT '{}'` constraint
- **If empty string inserted:** Stored as `''` in DB
- **Result:** `parseMetadata('')` returns `{}` ✅ **Works!**
- **This is likely the reported user's situation**

### Scenario 2: User with NEW table (Dec 18 - Jan 12) with type='text'

- **Table:** SHOULD have `DEFAULT '{}'` (if logic works correctly)
- **Needs verification:** Did this ever actually work?
- **If DEFAULT works:** Empty inserts become `'{}'` at DB level
- **If DEFAULT fails:** `parseMetadata()` still saves us

### Scenario 3: User with NEW table (after Jan 12) with type='jsonb'

- **Table:** NO `DEFAULT '{}'` (type check fails)
- **If empty string inserted:** Stored as `''` in DB
- **Result:** `parseMetadata('')` returns `{}` ✅ **Works!**
- **But:** No DB-level protection

## Tests Written

**File:** `stores/clickhouse/src/storage/index.test.ts`

### App-Level Protection Tests (verify parseMetadata works):

1. ✅ **Empty string metadata**: Direct insert with `''`, verify no crash
2. ✅ **Null metadata**: Direct insert with `null`, verify no crash
3. ✅ **Malformed JSON**: Direct insert with bad JSON, verify fallback to `{}`

### DB-Level Protection Tests (verify DEFAULT constraint):

4. ✅ **DEFAULT applied**: Drop/recreate table, verify DEFAULT in schema
5. ✅ **Old table without DEFAULT**: Manually create table without DEFAULT, verify parseMetadata saves us
6. ✅ **saveThread stores '{}'**: Verify DB contains '{}' after insert

**All 6 tests PASS with the fix applied**

## Next Steps

### Bug #1 (User's Original Issue):

**Status: WAITING FOR USER VERSION**

- The user reported this on an OLD version (@mastra/clickhouse 0.15.6 or earlier)
- The fix (`parseMetadata`) was already added in beta.0 (Nov 5, 2025)
- **User just needs to upgrade** to beta.0 or later
- We've asked the user for their version to confirm this

### Bug #2 (jsonb DEFAULT constraint):

**Status: ✅ FIXED**

1. ✅ Applied fix to support both 'text' and 'jsonb' types
2. ✅ Verified DEFAULT is applied with 'jsonb' type
3. ✅ All tests pass
4. ⏳ Ready for PR/commit

## Files Modified

1. `stores/clickhouse/src/storage/db/index.ts` - Fixed DEFAULT constraint logic
2. `stores/clickhouse/src/storage/index.test.ts` - Added 6 comprehensive tests
3. `ISSUE_SUMMARY11882.md` - This document
