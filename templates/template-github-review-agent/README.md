# GitHub PR Code Review Agent

An AI-powered code review agent built with [Mastra](https://mastra.ai/) that analyzes any GitHub pull request and returns detailed feedback directly in chat. It uses a structured workflow, workspace skills for review standards, observational memory for managing context across large PRs, and adaptive review depth based on PR size.

## Why we built this

This template shows how Mastra's workspace primitives enable you to build a powerful, flexible code review agent that can handle real-world PRs of any size.

## Demo

https://github.com/user-attachments/assets/6bef659b-e0a1-46e8-a8e5-affd96304184

This demo runs in Mastra Studio, but you can connect this workflow to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- Node.js >= 22.13.0
- pnpm
- A [GitHub Personal Access Token](https://github.com/settings/tokens) (read-only scope)
- An [Anthropic API Key](https://console.anthropic.com/)

## Getting started

```shell
pnpm install
cp .env.example .env
```

Fill in your `.env`:

```
GITHUB_TOKEN=ghp_...
ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

Start the dev server:

```shell
pnpm run dev
```

Open [http://localhost:4111](http://localhost:4111) to access Mastra Studio.

### Agent (Chat)

Open the **GitHub PR Code Reviewer** agent and give it a PR URL:

```
Review this PR: https://github.com/owner/repo/pull/123
```

The agent (Claude Sonnet) will fetch the PR, adaptively page through files based on PR size, and return a structured review. Observational memory compresses tool results between turns, allowing the agent to handle large PRs without truncating data.

### Workflow

Open the **Workflows** tab and run **pr-review-workflow** with `owner`, `repo`, and `pullNumber` inputs. The workflow runs a fixed 4-step pipeline and returns a structured JSON review.

## Customization

### Change review standards

Edit the files in `workspace/skills/` to match your team's conventions. The `SKILL.md` files define the review process; the `references/` files provide detailed checklists.

### Adjust thresholds

Edit `src/mastra/lib/review-config.ts`:

- `SMALL_PR_MAX` / `MEDIUM_PR_MAX` — PR size breakpoints for adaptive review depth.
- `SKIP_PATTERNS` — Regex patterns for files to skip during review.
- `MIN_DELETION_ONLY_LINES` — Threshold for skipping deletion-only files.

Batch sizes for the workflow are configured at the top of `src/mastra/workflows/pr-review-workflow.ts`:

- `BATCH_CHAR_BUDGET` — Max total characters per agent call (default: 400k).
- `BATCH_FILE_LIMIT` — Max files per agent call (default: 40).

### Swap models

Change the `model` field in the agent files. The `code-review-agent` uses Sonnet for quality; the `workflow-review-agent` uses Haiku for speed. Any Anthropic model works, or switch to another provider supported by Mastra.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](./CONTRIBUTING.md).
