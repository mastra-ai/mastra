# AGENTS.md

## Scope

This file applies to work in `packages/mcp/`.

## Commands

- Build from root: `pnpm --filter ./packages/mcp build:lib`
- Test from root: use `pnpm --filter ./packages/mcp test`, or the narrower `pnpm --filter ./packages/mcp test:client`, `pnpm --filter ./packages/mcp test:server`, or `pnpm --filter ./packages/mcp test:integration`

## Test shape

- This package splits client, server, and integration coverage
- Prefer the narrowest suite over running everything

## Notes

- Keep client, server, and shared protocol concerns separate
