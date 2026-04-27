Unless user explicitly asks do not inspect reference or modify examples
Prefer most specific AGENTS.md for changed area
For work in packages read package local packages/<name>/AGENTS.md first

turborepo pnpm workspace
packages use strict TypeScript
vitest tests are colocated with source

Prefer narrowest build test lint typecheck for packages
when package splits unit integration or E2E coverage run narrowest suite first
From root prefer specific scripts like pnpm build:core or pnpm --filter ./packages/name script
Do not pnpm run setup pnpm build pnpm build:packages or repo wide test runs when package local is enough
Building whole monorepo is slow and should be last resort
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
e2e-tests-studio REQUIRED for packages/playground-ui packages/playground E2E behavior tests
mastra-docs
react-best-practices
tailwind-best-practices
mastra-smoke-test
smoke-test create Mastra project and smoke test studio
