# AGENTS.md

## Scope

This file applies to work in `packages/rag/`.

## Commands

- Build from root: `pnpm build:rag`
- Test from root: `pnpm test:rag`
- Lint from root if needed: `pnpm --filter ./packages/rag lint`

## Test shape

- Most validation is package-scoped Vitest coverage
- Retrieval changes should use targeted tests for the exact path that changed

## Notes

- Be careful with chunking and query changes because relevance regressions are easy to miss in static checks
