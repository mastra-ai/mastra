Unless user explicitly asks do not inspect reference or modify examples
Prefer most specific AGENTS.md for changed area
For work in packages read package local packages/<name>/AGENTS.md first

turborepo pnpm workspace
packages use strict TypeScript
vitest tests are colocated with source
When adding a model name or ID to changesets or comments, use a literal value from docs/src/plugins/remark-model-tokens/models.ts (do not use placeholder tokens, remark does not replace them in changesets/comments)

Prefer narrowest package build/test/lint/typecheck; start with unit/integration before E2E
Local Vitest projects resolve exported workspace-package imports from source through @internal/lint/vitest. Do not prebuild workspace packages before local Vitest unit, integration, or Vitest e2e runs just to resolve internal imports.
Build only when validating package artifacts or when a test explicitly loads dist output (for example Verdaccio e2e tests, CLI/bin tests, or another documented build-required path). CI intentionally builds and tests dist output.
Use specific root scripts like pnpm build:core, pnpm --filter ./packages/name script, or pnpm turbo build --filter ./packages/<name>; these build that package's dependency graph
Avoid pnpm setup/build/build:packages unless package-local options are insufficient whole monorepo builds are slow and usually unneeded
Fresh clone: pnpm install. Build relevant packages only for the build-required cases above.
some integration tests need pnpm i --ignore-workspace

features and new packages need related docs updates
Follow docs/AGENTS.md and docs/styleguides when editing docs

After code changes follow @.mastracode/commands/changeset.md

Architecture
modular agent framework with central orchestration and pluggable components
packages/core/src
mastra/ central config hub dependency injection
agent/ abstraction with tools memory voice
tools/ agent tools
memory/ semantic recall working memory observational memory history persistence
workflows/ step based execution suspend resume
storage/ pluggable db backends with shared interfaces

Read relevant @.claude/commands/
changeset
commit
gh-new-pr
gh-pr-comments
make-moves

Read relevant @.claude/skills/
playground-msw-tests PRIMARY test approach for packages/playground packages/playground-ui
e2e-tests-studio SECONDARY test approach for packages/playground-ui packages/playground
mastra-docs
react-best-practices
tailwind-v4
mastra-frontend build app UI with the design system
mastra-smoke-test
smoke-test create Mastra project and smoke test studio
