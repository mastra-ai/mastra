# AGENTS.md

## Scope

This file applies to work in `packages/editor/`.

## Overview

- `editor` provides the Mastra editor runtime for agents, prompts, workspaces, and MCP-aware resources.
- It mixes namespace logic, providers, storage, and rules/templates.

## Commands

### Build

- `pnpm --filter ./packages/editor build` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:editor` from the repository root.

### Typecheck

- `pnpm typecheck` inside the package.
- `pnpm --filter ./packages/editor typecheck` from the repository root.

### Lint and format

- No package-local lint script is defined.
- Use `pnpm lint --filter ./packages/editor` only if you add a matching filtered root workflow, otherwise use the root lint flow as needed.

## Working guidelines

- Preserve the split between namespaces, providers, storage, and rule/template logic.
- Be careful with optional MCP integrations and filesystem-backed behavior.

## Verification

- Run `pnpm typecheck`, `pnpm test`, and `pnpm build` after meaningful changes.
- Prefer focused tests when working in one namespace or provider.

## Dependencies

- Depends on `@mastra/memory` and `@mastra/schema-compat`, and uses `@mastra/core` as a peer.
