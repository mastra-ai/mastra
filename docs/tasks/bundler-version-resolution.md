# Fix Dependency Version Resolution in Monorepos

## Status: COMPLETED

## Problem Summary

In `packages/deployer/src/bundler/index.ts` (lines 325-353), when resolving dependency versions:

1. **`getPackageRootPath(dep)`** was called without a `parentPath` context
2. In monorepos, this could resolve to the wrong package location (e.g., hoisted node_modules vs package-local node_modules)
3. If resolution failed entirely, it fell back to `'latest'` (line 351), which could cause version mismatches at runtime

## Root Cause

The `local-pkg` library's `getPackageInfo` function resolves from `process.cwd()` by default. In monorepos with hoisted dependencies, this may not find the correct version that the application actually uses.

## Solution Implemented

### Changes Made

1. **Updated `DependencyMetadata` type** (`packages/deployer/src/build/types.ts`)
   - Added `version?: string` field for exact version from package.json

2. **Added `ExternalDependencyInfo` type** (`packages/deployer/src/build/types.ts`)
   - New type for version information in external dependencies

3. **Updated `analyzeEntry`** (`packages/deployer/src/build/analyze/analyzeEntry.ts`)
   - Now reads package.json when resolving dependencies to capture version info
   - Uses the correct `entryRootPath` context for accurate resolution
   - Handles both static imports and dynamic imports

4. **Updated `analyzeBundle`** (`packages/deployer/src/build/analyze.ts`)
   - Changed `externalDependencies` from `Set<string>` to `Map<string, ExternalDependencyInfo>`
   - Propagates version info through the analysis pipeline
   - Updated `validateOutput` to accept and use version information

5. **Updated `_bundle`** (`packages/deployer/src/bundler/index.ts`)
   - Now uses pre-resolved version info from analysis
   - Still reads package.json at bundle time for alias detection (comparing import name vs actual package name)
   - Falls back to `'latest'` only if version couldn't be resolved

6. **Updated related files**
   - `packages/deployer/src/build/bundler.ts`: Updated to use Map.keys() for externals
   - `packages/deployer/src/build/watcher.ts`: Updated to use Map for externalDependencies
   - `packages/deployer/src/build/watcher.test.ts`: Updated test expectations

### Key Benefits

- **Correct version resolution in monorepos**: Version is now captured during analysis when we have the correct context path
- **Reduced redundant resolution**: No longer re-resolves versions at bundle time when already known
- **Preserved npm alias support**: Still correctly handles cases where import name differs from package name
- **Backward compatible**: Falls back to original resolution logic if version wasn't captured

---

## Design Decisions

1. **Fallback Behavior**: Keep `'latest'` as fallback, but ensure we can always resolve the package version correctly
2. **Version Format**: Store exact versions (e.g., `1.2.3`)
3. **Scope**: Focus on package.json generation only - `bundleExternals` looks at the current filesystem and doesn't need changes

---

## Files Changed

- `packages/deployer/src/build/types.ts`
- `packages/deployer/src/build/analyze/analyzeEntry.ts`
- `packages/deployer/src/build/analyze.ts`
- `packages/deployer/src/bundler/index.ts`
- `packages/deployer/src/build/bundler.ts`
- `packages/deployer/src/build/watcher.ts`
- `packages/deployer/src/build/watcher.test.ts`
