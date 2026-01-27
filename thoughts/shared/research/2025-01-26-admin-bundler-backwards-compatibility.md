# Admin Bundler Backwards Compatibility Research

**Date:** 2025-01-26
**Status:** In Progress
**Related:** AdminBundler, FileExporter injection, observability

## Problem Statement

The Admin bundler bundles user Mastra projects with workspace `@mastra/*` packages inlined. This causes backwards compatibility issues when:

1. The workspace packages have breaking changes not yet published to npm
2. User projects depend on older versions of `@mastra/*` packages
3. Runtime validation in workspace code fails on user configs that worked with older npm versions

## Observed Issues

### Issue 1: `zod-to-json-schema` Resolution (FIXED)

**Error:**
```
We couldn't load "zod-to-json-schema" from "zod"
```

**Root Cause:**
- pnpm stores dependencies in each package's `node_modules/`, not at monorepo root
- The bundler's `workspace-fallback-resolver` was positioned AFTER `nodeResolve`
- `nodeResolve` found wrong zod version (4.3.5) from playground-ui instead of zod 3.25.76 from core

**Fix Applied:**
- Moved `workspace-fallback-resolver` BEFORE `nodeResolve` in plugin order
- Fixed `getPackageRootPath` to use package name only, not full specifier with subpath
- `local-pkg`'s `getPackageInfo('zod/v4')` returns `rootPath: .../zod/v4` (includes subpath incorrectly)

### Issue 2: `async-mutex` Resolution (FIXED)

**Error:**
```
We couldn't load "async-mutex" from "async"
```

**Root Cause:**
- `@mastra/memory` depends on `async-mutex`
- `packages/memory` wasn't in the workspace fallback paths

**Fix Applied:**
- Added `packages/memory`, `packages/rag`, `packages/evals` to workspace fallback paths

### Issue 3: `LibSQLStore` Requires `id` Parameter (NOT FIXED)

**Error:**
```
Error: LibSQLStore: id must be provided and cannot be empty.
```

**Root Cause:**
- Workspace `LibSQLStore` requires `id` parameter in config
- User's npm-installed version may not require `id`
- User's Mastra config doesn't include `id` because their types don't require it

**TypeScript Error (user side):**
```
Object literal may only specify known properties, and 'id' does not exist in type 'LibSQLConfig'
```

**Affected Stores:**
- `@mastra/libsql` - `LibSQLStore`
- `@mastra/pg` - `PostgresStore`, `PgVector`
- `@mastra/mssql` - `MSSQLStore`

## Architecture Analysis

### Current Flow

```
User Project (npm @mastra packages)
         ↓
    Admin Bundler
         ↓
Bundles with workspace @mastra/* inline
         ↓
    Runtime Error
(workspace code validates against older user config)
```

### Why Inline Bundling?

The Admin bundler inlines workspace `@mastra/*` packages to:
1. Inject `FileExporter` for observability/span persistence
2. Ensure consistent versions across the bundle
3. Avoid `ERR_MODULE_NOT_FOUND` errors from version mismatches

### The Core Tension

- **Inline bundling** = consistent versions but breaks user configs
- **External packages** = respects user versions but can't inject observability reliably

## Potential Solutions

### Option A: Keep @mastra Packages as Externals

**Approach:**
- Don't bundle `@mastra/*` packages inline
- Let user's installed npm versions be used at runtime
- Only inject the FileExporter setup code

**Pros:**
- User's existing configs work unchanged
- No version mismatch issues
- Simpler bundling

**Cons:**
- Can't guarantee FileExporter compatibility with user's @mastra/core version
- May need version detection/compatibility layer
- User must have compatible @mastra packages installed

### Option B: Backwards Compatible Validation

**Approach:**
- Make all breaking validations backwards compatible
- Generate defaults for missing required fields (like `id`)

**Pros:**
- Maintains inline bundling benefits
- User configs still work

**Cons:**
- Large surface area - many packages affected
- Ongoing maintenance burden
- May hide legitimate configuration errors
- Doesn't solve future breaking changes

### Option C: Version Detection + Conditional Bundling

**Approach:**
- Detect user's installed @mastra package versions
- Bundle inline only if versions are compatible
- Fall back to external if versions differ significantly

**Pros:**
- Best of both worlds
- Graceful degradation

**Cons:**
- Complex implementation
- Version compatibility matrix to maintain

### Option D: Minimal Injection (Recommended)

**Approach:**
- Only inject the observability setup code
- Keep all @mastra packages as externals
- The FileExporter injection becomes a small wrapper that:
  1. Imports from user's @mastra/core
  2. Adds FileExporter to their existing observability setup

**Pros:**
- Minimal interference with user's code
- Works with any compatible @mastra version
- Clear separation of concerns

**Cons:**
- Requires user to have @mastra/observability installed
- FileExporter must be backwards compatible

## Files Modified During Investigation

### Resolution Fixes (Applied)

1. `packages/deployer/src/build/analyze/analyzeEntry.ts`
   - Added null byte check for virtual module importers
   - Fixed `getPackageRootPath` calls to use package name only

2. `packages/deployer/src/build/analyze/bundleExternals.ts`
   - Moved `workspace-fallback-resolver` before `nodeResolve`
   - Added more workspace packages to fallback paths
   - Fixed `getPackageRootPath` to use `pkgName` not `id`

### Backwards Compatibility Attempts (Reverted)

1. `stores/libsql/src/storage/index.ts`
   - Made `id` optional with default fallback

2. `stores/pg/src/shared/config.ts`
   - Made `id` optional in `PostgresBaseConfig`
   - Updated `validateConfig` to return resolved id

3. `stores/mssql/src/storage/index.ts`
   - Made `id` optional with default fallback

## Recommendations

1. **Short term:** Revert backwards compatibility changes, document that Admin requires compatible @mastra versions

2. **Medium term:** Implement Option D (Minimal Injection) - only inject FileExporter wrapper, keep @mastra packages external

3. **Long term:** Consider Option C (Version Detection) for graceful handling of version mismatches

## Open Questions

1. What is the minimum @mastra version supported by Admin?
2. Should FileExporter injection fail gracefully if observability isn't configured?
3. How do we handle users who don't have @mastra/observability installed?

## Related Code Locations

- `packages/deployer/src/build/analyze/bundleExternals.ts` - External dependency bundling
- `packages/deployer/src/build/bundler.ts` - Main bundler configuration
- `runners/local/src/bundler/admin-bundler.ts` - AdminBundler entry point
- `stores/*/src/storage/index.ts` - Storage adapter constructors
