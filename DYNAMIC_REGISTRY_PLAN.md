# Dynamic Provider Registry Loading & Hourly Refresh Plan

## Overview

Implement dynamic loading and hourly refreshing of provider/model data from gateways, with automatic regeneration of both `provider-registry.json` and `provider-types.generated.d.ts` files at runtime.

---

## Phase 1: Create a ModelRegistry Class

**File: `packages/core/src/llm/model/model-registry.ts`**

This new class will manage:

* Dynamic loading of `provider-registry.json`
* Hourly refresh scheduling from gateways
* Automatic regeneration of `.d.ts` files at runtime
* Cache invalidation
* Thread-safe access to registry data

### Key Methods

**Public API:**
* `getInstance()` - Singleton pattern
* `syncGateways(forceRefresh = false)` - Fetch from gateways and regenerate files (public method for manual sync)
* `getProviderConfig(providerId)` - Get provider config
* `getProviders()` - Get all providers
* `getModels()` - Get all models
* `isProviderRegistered(providerId)` - Check if provider exists
* `getLastRefreshTime()` - Get last refresh timestamp
* `startAutoRefresh(intervalMs = 3600000)` - Start hourly auto-refresh (default 1 hour)
* `stopAutoRefresh()` - Stop auto-refresh

**Private/Internal methods:**
* `loadRegistry()` - Load from disk
* `fetchProvidersFromGateways()` - Fetch fresh data from all gateways
* `regenerateFiles(providers, models)` - Write JSON and .d.ts to disk
* `resolveFilePaths()` - Use `createRequire` and path resolution to find correct file locations
* `getGateways()` - Get configured gateways (ModelsDevGateway, NetlifyGateway)

---

## Phase 2: Runtime .d.ts File Generation

**Challenge:** Need to locate and update `.d.ts` files at runtime so TypeScript/IDEs pick up changes.

**Solution:**

1. Use `createRequire(import.meta.url)` to resolve the module's location
2. Find the actual file path of `provider-types.generated.d.ts` on disk
3. Regenerate the file content (same logic as `generate-providers.ts`)
4. Write directly to the resolved file path
5. TypeScript/IDEs will automatically detect file changes and reload types

**Key considerations:**
* Always write to `dist/llm/model/` (the bundled location)
* When `MASTRA_DEV=true` (dev server running), ALSO write to `src/llm/model/` for development convenience
* `MASTRA_DEV=true` only when `mastra dev` dev server is running (not general development)
* Use path resolution to find the correct `dist/` location in both development and production environments

---

## Phase 4: Update provider-registry.ts

**File: `packages/core/src/llm/model/provider-registry.ts`**

**Changes:**

* Delegate to `ModelRegistry` singleton instead of direct file loading
* Keep the same exports (`PROVIDER_REGISTRY`, `PROVIDER_MODELS`, helper functions)
* Maintain backward compatibility
* Update `loadRegistry()` to call `ModelRegistry.getInstance().loadRegistry()`

**No breaking changes** - existing code continues to work.

---

## Phase 5: Integration with Existing Code

**Update these files to support dynamic refresh:**

1. **`packages/core/src/llm/model/router.ts`**
   * Use `ModelRegistry` for provider lookups if needed
   * Should work automatically via updated `provider-registry.ts`

2. **`packages/core/src/llm/model/gateways/base.ts`**
   * Ensure gateway interface is properly exported
   * No changes needed, just verification

3. **`packages/core/tsup.config.ts`**
   * Ensure JSON file copying still works
   * Ensure .d.ts file copying still works

---

## Phase 6: Add Configuration Options

**New environment variables:**

* `MASTRA_AUTO_REFRESH_PROVIDERS` - Enable/disable auto-refresh
  * Default: `true` when `MASTRA_DEV=true` (dev server running), `false` otherwise
  * Set to `'true'` or `'1'` to enable, `'false'` or `'0'` to disable
  * Only auto-refreshes when dev server is running to avoid unexpected network calls in production

* `MASTRA_REFRESH_INTERVAL_MS` - Refresh interval in milliseconds
  * Default: `3600000` (1 hour)
  * Minimum: `60000` (1 minute) to prevent excessive API calls

* `MASTRA_DEV` - Already exists, set by `mastra dev` command
  * `'true'` = dev server is running (write to both `dist/` and `src/`)
  * Otherwise = production or general development (write to `dist/` only)

---

## Phase 7: Testing

**New test file: `packages/core/src/llm/model/model-registry.test.ts`**

Tests:
* ✅ Singleton pattern works correctly
* ✅ Manual refresh from gateways
* ✅ Auto-refresh scheduling and cleanup
* ✅ Cache invalidation
* ✅ File path resolution (dev vs production)
* ✅ .d.ts file regeneration
* ✅ Graceful error handling (network failures, file write errors)
* ✅ Mock file system and gateway calls

**Update existing tests:**
* Ensure `router.integration.test.ts` still passes
* Ensure `model.test.ts` still passes

---

## Phase 8: Documentation

**Update files:**

1. `MODEL_ROUTER_IMPLEMENTATION_GUIDE.md` - Add section on dynamic refresh
2. `packages/core/README.md` - Document new environment variables
3. Add JSDoc comments to all new public methods

---

## Key Design Decisions

. **Gateway-Centric**: All refresh operations are based on fetching from gateways, not individual providers
. **Singleton Pattern**: Ensures only one registry instance exists, preventing multiple refresh timers
. **Lazy Loading**: Registry loads on first access, not at module import time
. **Auto-Refresh Only in Dev Server**: Enabled by default when `MASTRA_DEV=true`, disabled otherwise to avoid unexpected network calls in production
. **Runtime Type Updates**: .d.ts files are regenerated at runtime and TypeScript/IDEs automatically pick up changes
. **Graceful Degradation**: If refresh fails, keep using cached data and log errors
. **Path Resolution**: Use `createRequire` and `import.meta.resolve` to find correct file locations in both dev and production
. **Dual Write in Dev**: When dev server is running, write to both `dist/` and `src/` for convenience

---

## Implementation Order

1. ✅ Extract generation logic from `generate-providers.ts` into reusable functions
2. ✅ Create `ModelRegistry` class with core loading logic
3. ✅ Add file path resolution logic (dev vs production)
4. ✅ Add .d.ts regeneration functionality
5. ✅ Add refresh functionality (manual + auto)
6. ✅ Update `provider-registry.ts` to delegate to `ModelRegistry`
7. ✅ Add configuration via environment variables
8. ✅ Write tests
9. ✅ Update documentation
10. ✅ Test in real project to verify IDE autocomplete updates

---

## Open Questions

1. ✅ **RESOLVED**: `forceRefresh` is now an argument in `syncGateways(forceRefresh = false)`
2. ✅ **RESOLVED**: Add debug logs for monitoring (use `console.debug` or similar)
3. ✅ **YES**: Add maximum retry count for failed gateway fetches (default: 3 retries)
4. ❌ **NO**: Skip CLI command for now, can add later if needed

---

## Success Criteria

* ✅ `provider-registry.json` is automatically refreshed every hour (when dev server is running)
* ✅ `provider-types.generated.d.ts` is automatically regenerated when data changes
* ✅ TypeScript autocomplete in IDEs updates automatically after refresh
* ✅ All existing tests pass
* ✅ No breaking changes to existing API
* ✅ Graceful error handling for network failures
* ✅ Works in both development and production environments
* ✅ **User testing**: Tyler confirms it works by observing auto-refresh in action during `mastra dev`
