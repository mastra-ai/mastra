# AGENTS.md

## Scope

This file applies to work in `packages/mcp-registry-registry/`.

## Overview

- `mcp-registry-registry` is a meta-registry MCP server for discovering other MCP registries.
- Keep it focused on registry discovery and MCP exposure.

## Commands

### Build

- `pnpm --filter ./packages/mcp-registry-registry build` from the repository root.
- Use `pnpm --filter ./packages/mcp-registry-registry build:cli` from the repository root when you specifically need the stdio entrypoint.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/mcp-registry-registry test` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/mcp-registry-registry lint` from the repository root.

## Working guidelines

- Keep registry fetching, processing, and MCP serving responsibilities distinct.
- Preserve the existing ESM-only packaging behavior.

## Verification

- Run `pnpm test` after registry logic changes.
- Run the relevant build command after packaging or entrypoint changes.

## Dependencies

- Downstream consumers are MCP clients and registry-discovery tools.
