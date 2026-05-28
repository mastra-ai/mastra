Unless user explicitly asks do not inspect reference or modify examples
Prefer most specific AGENTS.md for changed area
For work in packages read package local packages/<name>/AGENTS.md first

turborepo pnpm workspace
packages use strict TypeScript
vitest tests are colocated with source
When you need to add a model name or ID to examples, changesets, tests, or comments, use one of the placeholder tokens from docs/src/plugins/remark-model-tokens/models.ts

Prefer narrowest build test lint typecheck for packages
when package splits unit integration or E2E coverage run narrowest suite first
From root prefer specific scripts like pnpm build:core or pnpm --filter ./packages/name script
Do not pnpm run setup pnpm build pnpm build:packages or repo wide test runs when package local is enough
Building whole monorepo is slow and should be last resort
Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` with focused tests/dev when workspace packages should resolve from source, e.g. `MASTRA_SOURCE_MODE=true pnpm test:cli` or linked-project `MASTRA_SOURCE_MODE=true mastra dev`. Published CLI installs ignore it.
Before pushing commits or opening PRs run the narrowest relevant local checks; if CodeRabbit CLI is installed and configured, run a local CodeRabbit review too
some integration tests need pnpm i --ignore-workspace

features and new packages need related docs updates
Follow docs/AGENTS.md and docs/styleguides when editing docs

After code changes follow @.mastracode/commands/changeset.md

Architecture
modular agent framework; packages/core/src has mastra config hub, agents/tools, memory, workflows, storage.

Read relevant @.claude/commands/ before changesets, commits, PRs, or comments.

Read relevant @.claude/skills/: playground-msw-tests primary for playground; e2e-tests-studio secondary; mastra-docs; react/tailwind best practices; mastra-smoke-test/smoke-test.
