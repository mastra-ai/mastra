# AGENTS.md

## Scope

This file applies to work in `packages/mcp-docs-server/`.

## Overview

- `mcp-docs-server` exposes Mastra docs and migration/course helpers through MCP.
- Most changes touch docs preparation, MCP tool behavior, or prompt wiring.

## Commands

### Build

- `pnpm build:docs-mcp` from the repository root.
- Use `pnpm --filter ./packages/mcp-docs-server build:cli` from the repository root when you specifically need the CLI bundle.

### Test

- `pnpm test` inside the package.
- `pnpm test:docs-mcp` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/mcp-docs-server lint` from the repository root.

## Working guidelines

- Keep prepared-docs ingestion separate from runtime MCP serving logic.
- Preserve tool and prompt contracts for MCP clients.

## Verification

- Run `pnpm test` after logic changes.
- Run `pnpm prepare-docs` when changing documentation ingestion or preparation.

## Dependencies

- Depends on `@mastra/core`, `@mastra/mcp`, and the MCP SDK.
