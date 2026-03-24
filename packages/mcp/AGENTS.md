# AGENTS.md

## Scope

This file applies to work in `packages/mcp/`.

## Overview

- `mcp` is Mastra's Model Context Protocol package for client and server integrations.
- It affects both internal integrations and external MCP interoperability.

## Commands

### Build

- `pnpm build:mcp` from the repository root.

### Test

- `pnpm test`, `pnpm test:client`, `pnpm test:server`, or `pnpm test:integration` inside the package.
- `pnpm test:mcp` from the repository root.
- Prefer the client/server/integration split over running everything while iterating.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/mcp lint` from the repository root.

## Working guidelines

- Keep client, server, and shared code concerns separate.
- Be careful with protocol compatibility, OAuth flows, and external SDK behavior.

## Verification

- Run the narrowest relevant suite first; do not default to broad repo verification for client-only or server-only MCP changes.
- Run `pnpm build:lib` for export or packaging changes.

## Dependencies

- Downstream packages include editor integrations and MCP-related servers.
