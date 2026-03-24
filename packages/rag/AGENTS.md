# AGENTS.md

## Scope

This file applies to work in `packages/rag/`.

## Overview

- `rag` provides retrieval-augmented generation utilities, including document processing, vector-query tools, and GraphRAG logic.
- Changes here usually affect retrieval behavior or document-processing flows.

## Commands

### Build

- `pnpm build:rag` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm test:rag` from the repository root.
- Use `pnpm vitest` inside the package for watch-mode iteration.

### Typecheck

- No package-local typecheck script is defined.
- Use build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/rag lint` from the repository root.

## Working guidelines

- Keep document processing, retrieval logic, reranking, and tool helpers separate.
- Be careful with chunking and query changes because relevance regressions are easy to miss in static checks.

## Verification

- Run `pnpm test` after behavior changes.
- Prefer targeted tests for the exact retrieval path you changed.

## Dependencies

- Uses `@mastra/core` as a peer and feeds downstream agent/workflow retrieval behavior.
