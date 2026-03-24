# AGENTS.md

## Scope

This file applies to work in `packages/_llm-recorder/`.

## Overview

- `_llm-recorder` records and replays LLM traffic for deterministic tests.
- Small changes here can destabilize downstream test suites.

## Commands

### Build

- `pnpm --filter ./packages/_llm-recorder build` from the repository root.

### Test

- `pnpm test` inside the package.
- `pnpm --filter ./packages/_llm-recorder test` from the repository root.

### Typecheck

- No package-local typecheck script is defined.
- Use the build and test commands to validate changes.

### Lint and format

- `pnpm lint` inside the package.
- `pnpm --filter ./packages/_llm-recorder lint` from the repository root.

## Working guidelines

- Preserve replay determinism, request matching, and recording format compatibility.
- Be cautious with streaming and timing behavior.

## Verification

- Run `pnpm test` for logic changes.
- Run `pnpm build` if you touch exports or packaging.

## Dependencies

- `_test-utils` and multiple package test suites depend on this package.
