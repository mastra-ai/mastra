# Repository guidance

Unless asked, don't inspect reference or modify examples.
Use the most-specific `AGENTS.md`; for package work, read `packages/<name>/AGENTS.md` first.

Turborepo pnpm workspace; packages use strict TypeScript; Vitest tests are colocated.
For schema-backed execution, put deterministic input/output constraints (shape, types, ranges, formats, cross-field invariants) in schemas, not `execute`. Keep runtime/external checks (authorization, existence, conflicts, API responses) in `execute`.
Use literal model names/IDs from `docs/src/plugins/remark-model-tokens/models.ts` in changesets/comments; placeholders are not replaced.

Use the narrowest package build/test/lint/typecheck (`pnpm --filter`); run unit/integration before E2E; avoid root setup/build scripts. Vitest resolves workspace imports from source, so don't prebuild for tests. Suites in `vitest.dist-tests.json` test build output: build, then run with `MASTRA_TEST_DIST=1`. Some integration tests need `pnpm i --ignore-workspace`.

Features/new packages need docs; follow `docs/AGENTS.md` and styleguides, then run `pnpm check` in `docs/`. After code changes, read `@.mastracode/commands/changeset.md`.

Architecture: `packages/core/src`; `mastra/` config/DI; `agent/`, `tools/`, `memory/`, `workflows/`, `storage/` are modular framework components.

Read applicable `@.claude/commands/`: `changeset`, `commit`, `gh-new-pr`, `gh-pr-comments`, `make-moves`.
Read `@.agents/skills/real-world-testing` before writing any test or fixing any bug.
Read applicable `@.claude/skills/`: `playground-msw-tests` (primary for playground/UI), `e2e-tests-studio` (secondary), `mastra-docs`, `react-best-practices`, `tailwind-v4`, `mastra-frontend`, `mastra-smoke-test`, `smoke-test`.
