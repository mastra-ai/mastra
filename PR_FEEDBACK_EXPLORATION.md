# PR #12295 Feedback Exploration

## Feedback Summary

### 1. Centralize Normalization Function
**Status:** DONE

There's an existing `normalizeStudioBase` function in `packages/deployer/src/build/utils.ts` that's more robust than our new `normalizePrefix` functions. It includes:
- Path traversal prevention (`..`)
- Query param/hash prevention (`?`, `#`)
- Multiple slash normalization (`//` → `/`)
- Leading/trailing slash handling

**Current locations with normalization:**
- `client-sdks/client-js/src/resources/base.ts` - `normalizePrefix()`
- `packages/server/src/server/server-adapter/index.ts` - `normalizePrefix()`
- `packages/deployer/src/build/utils.ts` - `normalizeStudioBase()` (existing)

**Action:** Move to `@mastra/core` and reuse everywhere.

---

### 2. Rename `prefix` → `apiPrefix`
**Status:** TODO

Since `studioBase` already exists, just `prefix` is ambiguous.

**Locations to update:**
- `client-sdks/client-js/src/types.ts` - `prefix` option
- `packages/playground-ui/src/domains/configuration/types.ts` - `prefix` field
- Related context/form components

---

### 3. Rename CLI `--server-prefix` → `--api-prefix`
**Status:** TODO

**Locations:**
- `packages/cli/src/index.ts` - CLI option definition
- `packages/cli/src/commands/studio/studio.ts` - option handling

---

### 4. Separate Changesets
**Status:** TODO (before merge)

Split the single changeset into individual ones per package.

---

### 5. Investigate `MASTRA_STUDIO_BASE_PATH`
**Status:** TODO

mfrachet mentioned this env var already exists at the server level. Need to understand:
- Where is it used?
- How does it relate to our `apiPrefix`?
- Are we duplicating functionality?

---

## Exploration Notes

### normalizeStudioBase vs normalizePrefix

```typescript
// Existing in deployer (more robust)
export function normalizeStudioBase(studioBase: string): string {
  // Validate: no path traversal, no query params, no special chars
  if (studioBase.includes('..') || studioBase.includes('?') || studioBase.includes('#')) {
    throw new Error(`Invalid base path: "${studioBase}". Base path cannot contain '..', '?', or '#'`);
  }

  // Normalize multiple slashes to single slash
  studioBase = studioBase.replace(/\/+/g, '/');

  // Handle default value cases
  if (studioBase === '/' || studioBase === '') {
    return '';
  }

  // Remove trailing slash
  if (studioBase.endsWith('/')) {
    studioBase = studioBase.slice(0, -1);
  }

  // Add leading slash if missing
  if (!studioBase.startsWith('/')) {
    studioBase = `/${studioBase}`;
  }

  return studioBase;
}
```

```typescript
// Our simpler version in client-js/server
function normalizePrefix(prefix: string): string {
  let normalized = prefix.trim();
  if (normalized === '' || normalized === '/') {
    return '';
  }
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
```

**Differences:**
- Existing version validates against path traversal/query params
- Existing version normalizes multiple slashes
- Our version trims whitespace
- Both handle empty/slash-only and leading/trailing slashes

**Combined version should have all features.**
