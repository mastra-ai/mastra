Unless user explicitly asks do not inspect reference or modify examples
Prefer most specific AGENTS.md for changed area
For work in packages read package local packages/<name>/AGENTS.md first

turborepo pnpm workspace
packages use strict TypeScript
vitest tests are colocated with source
When adding a model name or ID to changesets or comments, use a literal value from docs/src/plugins/remark-model-tokens/models.ts (do not use placeholder tokens, remark does not replace them in changesets/comments)

Prefer narrowest build test lint typecheck for packages
when package splits unit integration or E2E coverage run narrowest suite first
From root prefer specific scripts like pnpm build:core or pnpm --filter ./packages/name script
Do not pnpm run setup pnpm build pnpm build:packages or repo wide test runs when package local is enough
Building whole monorepo is slow and should be last resort
Before pushing commits or opening PRs run the narrowest relevant local checks; if CodeRabbit CLI is installed and configured, run a local CodeRabbit review too
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
tailwind-best-practices
mastra-smoke-test
smoke-test create Mastra project and smoke test studio
