# Agent Builder

A minimal [Mastra](https://mastra.ai) Agent Builder template with safe defaults. It includes only the Mastra and Agent Builder setup, with no starter agents, tools, or workflows.

## Features

- Agent Builder enabled by default
- Optional WorkOS AuthKit authentication and WorkOS-backed RBAC permissions
- Local filesystem workspace at `.mastra/workspace`
- No starter agents, tools, or workflows
- Observational memory enabled for builder-created agents
- Optional providers only register when their environment variables are configured

## Prerequisites

- Node.js 22.13 or newer
- An OpenAI API key
- A valid `MASTRA_EE_LICENSE` for running Agent Builder in production

## Quickstart

1. **Create the project**

   ```bash
   npx create-mastra@latest --template agent-builder
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env`, then set:
   - `MASTRA_EE_LICENSE` — required to run Agent Builder in production. Development environments run without one.
   - `OPENAI_API_KEY` — required for builder-created agents that use the default OpenAI model.

   Authentication is optional. See [Optional integrations](#optional-integrations) for WorkOS and other providers.

3. **Start Mastra**

   ```bash
   npm run dev
   ```

4. **Open Studio**
   Visit [localhost:4111](http://localhost:4111) and open Agent Builder.

## Optional integrations

The template does not register optional integrations with empty credentials. They appear only after you set their required environment variables:

- **WorkOS AuthKit (auth + RBAC)**: set `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and `WORKOS_COOKIE_PASSWORD` (the cookie password must be at least 32 characters). `WORKOS_REDIRECT_URI` is optional and defaults to `http://localhost:4111/api/auth/callback`. When these are unset, the template runs without authentication.
- **Composio**: set `COMPOSIO_API_KEY`.
- **Slack**: set `SLACK_APP_CONFIG_TOKEN` and `SLACK_APP_CONFIG_REFRESH_TOKEN`. `SLACK_BASE_URL` is optional.
- **Browserbase + Stagehand**: set both `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID`.

Git credentials are not needed for the default template. The workspace uses the local filesystem, so there are no `GIT_*` or `GITHUB_TOKEN` requirements.

## Making it yours

Edit the files under `src/mastra` to add your own resources and adjust the setup:

- `index.ts` configures Mastra, Agent Builder, auth/RBAC, and optional providers.
- `auth.ts` configures WorkOS AuthKit and role-to-permission mappings.
- `workspace.ts` configures the local filesystem workspace.
- `env.ts` contains the environment variable helpers and license guard.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build with Mastra. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are synced to standalone repositories for easier cloning.
