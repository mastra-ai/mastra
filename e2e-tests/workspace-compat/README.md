# Workspace Version Compatibility E2E Test

Tests that `isWorkspaceV1Supported` logic correctly detects version mismatches between `@mastra/core` and `@mastra/client-js`.

## How It Works

1. **Setup**: Starts a local Verdaccio registry and publishes current package versions
2. **Test Project**: Creates a temporary project that installs packages from the local registry
3. **Compatibility Tests**:
   - Verifies `coreFeatures.has('workspaces-v1')` returns true with current core
   - Verifies client has `listWorkspaces` and `getWorkspace` methods
   - Tests that combined check returns true when versions match
   - Tests that check returns false when core lacks feature (simulated)
   - Tests that check returns false when client lacks methods (simulated)

## Running

From the monorepo root:

```bash
cd e2e-tests/workspace-compat
pnpm install
pnpm test
```

Or from the root:

```bash
pnpm --filter workspace-compat-e2e-test test
```

## Test Cases

1. **Matching versions** - Both core and client support workspace v1 → `isSupported: true`
2. **Old core** (simulated) - Core missing `workspaces-v1` feature → `isSupported: false`
3. **Old client** (simulated) - Client missing workspace methods → `isSupported: false`
