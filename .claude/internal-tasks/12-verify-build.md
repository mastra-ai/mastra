# Task 12: Verify Build and Typecheck

## Summary

Verify that all changes build and pass typechecking.

## Commands to Run

### 1. Typecheck

```bash
pnpm typecheck
```

### 2. Build Core

```bash
pnpm build:core
```

### 3. Build GitHub Inbox Package

```bash
cd tasks/github && pnpm build
```

### 4. Full Build

```bash
pnpm build
```

## Common Issues to Check

### Import Paths

- Ensure all imports use correct paths
- Check for circular dependencies

### Type Exports

- All types used in public API should be exported
- Generic constraints should be correct

### Missing Dependencies

- Check that @mastra/core has all needed dependencies
- Check tasks/github/package.json has @octokit/rest

## Fixes to Apply

Document any build errors and fix them.

## Acceptance Criteria

- [ ] pnpm typecheck passes
- [ ] pnpm build:core passes
- [ ] tasks/github builds
- [ ] No circular dependency warnings
- [ ] All exports resolve correctly
