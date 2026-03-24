# AGENTS.md

## Scope

This file applies to work in `packages/_vendored/` and its versioned child packages.

## Overview

- `_vendored` contains the versioned AI SDK wrapper packages under `ai_v4/`, `ai_v5/`, and `ai_v6/`.
- Most work here is version-specific build and type-output maintenance.

## Commands

### Build

- Run the build for the specific child package you changed from the repository root.
- Use `pnpm --filter ./packages/_vendored/ai_v4 build`, `pnpm --filter ./packages/_vendored/ai_v5 build`, or `pnpm --filter ./packages/_vendored/ai_v6 build`.

### Test

- Run `pnpm test` inside the specific child package when relevant.
- From the repository root, run the matching filtered test command for the touched child package.

### Typecheck

- No top-level typecheck script is defined.
- Use the child package build as the main validation step.

### Lint and format

- Run `pnpm lint` inside the specific child package when relevant.
- From the repository root, run the matching filtered lint command for the touched child package.

## Working guidelines

- Keep version-specific differences explicit instead of over-abstracting them.
- Verify only the child package you changed unless a shared pattern affects multiple versions.

## Verification

- Run the build for each touched child package.
- Verify generated type output when you touch embedding or post-build logic.

## Dependencies

- Downstream packages rely on these wrappers for AI SDK version compatibility.
