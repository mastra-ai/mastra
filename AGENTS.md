# AGENTS.md

This file provides guidance to coding agents when working in this repository.

## Scope guidelines

- Unless the user explicitly asks for it, do not inspect, reference, or modify files in `examples/`.
- Prefer the most specific `AGENTS.md` file available for the directory you are changing.
- For work in `packages/*`, read the package-local `packages/<name>/AGENTS.md` before making changes.

## Monorepo structure

- This repository is a `pnpm` workspace orchestrated with Turborepo.
- Major areas include `auth/`, `client-sdks/`, `deployers/`, `docs/`, `integrations/`, `observability/`, `packages/`, `pubsub/`, `server-adapters/`, `stores/`, `voice/`, `workflows/`, and `workspaces/`.
- The `docs/` area has its own instructions in `docs/AGENTS.md`.
- All packages use TypeScript with strict type checking.
- Vitest is the default test runner, with tests usually co-located with source files.

## Development guidance

- Prefer the narrowest relevant build, test, and typecheck commands for the code you changed.
- For `packages/*` work, start with the package's own scripts from inside the package directory.
- If you need to work from the repository root, prefer package-specific root scripts such as `pnpm build:core` or filtered commands such as `pnpm --filter ./packages/<name> <script>`.
- Do not default to `pnpm run setup`, `pnpm build`, `pnpm build:packages`, or repo-wide test runs when a package-local or filtered command is sufficient.
- Building the entire monorepo is slow and should be a last resort, not the default verification path.
- Use broader verification only when changes cross package boundaries, affect shared exports/contracts, or touch shared build tooling.
- Integration tests may require `pnpm dev:services:up` / `pnpm dev:services:down` and, in some integration-test folders, `pnpm i --ignore-workspace`.

## Shared repository commands

### Build

- Avoid repo-wide builds unless the change truly spans multiple packages or shared build tooling.
- `pnpm build` - Build the repository except docs and examples.
- `pnpm build:packages` - Build all packages under `packages/`.
- `pnpm build:deployers` - Build deployment adapters.
- `pnpm build:combined-stores` - Build storage adapters.

### Test

- `pnpm test:core`, `pnpm test:memory`, `pnpm test:rag`, `pnpm test:cli`, `pnpm test:auth`, `pnpm test:server-adapters` - Targeted root test entry points for common packages.
- When a package splits unit, integration, or E2E coverage, run the narrowest relevant suite first.
- `pnpm dev:services:up` / `pnpm dev:services:down` - Start or stop Docker-backed services required by some integration suites.

### Lint and format

- Prefer package-local lint or typecheck scripts when they exist.
- `pnpm typecheck` - TypeScript checks across the workspace.
- `pnpm prettier:format` - Format code with Prettier.
- `pnpm format` - Run linting with auto-fixes across packages.

## Documentation

- Code changes must include related documentation updates when needed.
- Follow `docs/AGENTS.md` and the styleguides under `docs/styleguides/` when editing docs.

**Important:** If you add a new package, you also MUST add new documentation for that package in `@docs/`.

## Changelogs

- After code changes, create a changeset.
- Follow `@.mastracode/commands/changeset.md` for changeset guidance.

## Architecture overview

Mastra is a modular AI framework built around central orchestration with pluggable components.

### Core components (`packages/core/src/`)

- **Mastra Class** (`mastra/`) - Central configuration hub with dependency injection.
- **Agents** (`agent/`) - AI interaction abstraction with tools, memory, and voice.
- **Tools** (`tools/`) - Dynamic tool composition from multiple sources.
- **Memory** (`memory/`) - Thread-based persistence with semantic recall and working memory.
- **Workflows** (`workflows/`) - Step-based execution with suspend/resume.
- **Storage** (`storage/`) - Pluggable backends with shared interfaces.

## Commands

Reusable command prompts are available in `.claude/commands/`. All agents should read and follow the relevant command file when performing these tasks.

- **Changeset** (`.claude/commands/changeset.md`) — Create a changeset using the CLI for changelog generation.
- **Commit** (`.claude/commands/commit.md`) — Commit work using conventional commits with a concise message, then push.
- **Document** (`.claude/commands/document.md`) — Examine a GitHub issue and write documentation for it.
- **Bulk Issue Solver** (`.claude/commands/gh-bulk-issues.md`) — Orchestrate parallel headless instances to debug and fix multiple GitHub issues simultaneously.
- **Debug Issue** (`.claude/commands/gh-debug-issue.md`) — Examine and debug a GitHub issue using the GH CLI.
- **Fix CI** (`.claude/commands/gh-fix-ci.md`) — Diagnose and fix GitHub Actions CI failures for the current branch's PR.
- **Fix Lint** (`.claude/commands/gh-fix-lint.md`) — Fix linting and formatting issues for a GitHub PR branch.
- **New PR** (`.claude/commands/gh-new-pr.md`) — Open a PR for the current branch using the GH CLI.
- **PR Comments** (`.claude/commands/gh-pr-comments.md`) — View and handle PR review comments.
- **Make Moves** (`.claude/commands/make-moves.md`) — Examine a GitHub issue and implement the fix as an engineer on the Mastra framework.
- **PR** (`.claude/commands/pr.md`) — Create a changeset and open a PR for the current branch.
- **Ralph Plan** (`.claude/commands/ralph-plan.md`) — Interactive assistant for building focused ralph-loop commands.

## Skills

This repository includes domain-specific guidance as skills in `.claude/skills/`. All agents should read the relevant skill file before performing work in that area.

- **E2E Tests for Studio** (`.claude/skills/e2e-tests-studio/SKILL.md`) — REQUIRED when modifying any file in `packages/playground-ui` or `packages/playground`. Covers Playwright E2E test generation that validates product behavior.
- **Mastra Docs** (`.claude/skills/mastra-docs/SKILL.md`) — Guidelines for writing or editing Mastra documentation.
- **React Best Practices** (`.claude/skills/react-best-practices/SKILL.md`) — React performance optimization patterns. Read when writing, reviewing, or refactoring React components.
- **Tailwind Best Practices** (`.claude/skills/tailwind-best-practices/SKILL.md`) — Tailwind CSS and design-system guidelines for `packages/playground-ui` and `packages/playground`.
- **Mastra Smoke Test** (`.claude/skills/mastra-smoke-test/SKILL.md`) — Procedures for smoke testing Mastra projects locally or against staging/production.
- **Smoke Test** (`.claude/skills/smoke-test/SKILL.md`) — Creating a Mastra project with `create-mastra` and smoke testing the studio in Chrome.
- **Ralph Plan** (`.claude/skills/ralph-plan/SKILL.md`) — Interactive planning assistant for building ralph-loop commands.

## Enterprise Edition (EE) licensing

- Any directory named `ee/` is licensed under the Mastra Enterprise License.
- Everything else is Apache-2.0 unless noted otherwise.
- EE code is imported through subpath exports such as `@mastra/core/auth/ee`.
- New EE features should live in an `ee/` subdirectory within the relevant package.
- `LICENSE.md` maps directories to their licenses.
