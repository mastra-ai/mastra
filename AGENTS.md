Unless user explicitly asks do not inspect reference or modify examples
Prefer most specific AGENTS.md for changed area
For work in packages read package local packages/<name>/AGENTS.md first

turborepo pnpm workspace
packages use strict TypeScript
vitest tests are colocated with source
When adding a model name or ID to changesets or comments, use a literal value from docs/src/plugins/remark-model-tokens/models.ts (do not use placeholder tokens, remark does not replace them in changesets/comments)

Prefer narrowest package build/test/lint/typecheck; start with unit/integration before E2E.
Local Vitest projects resolve exported workspace imports from source through @internal/lint/vitest. Do not prebuild packages for local unit, integration, or Vitest e2e tests.
Build only for artifacts or tests that load dist directly (such as Verdaccio or CLI/bin tests); CI intentionally builds and tests dist.
Use package-scoped scripts or `pnpm turbo build --filter ./packages/<name>`; avoid whole-monorepo builds. Some integration tests need `pnpm i --ignore-workspace`.

Features and new packages need related docs. Follow docs/AGENTS.md and styleguides when editing docs.
After code changes follow @.mastracode/commands/changeset.md.
