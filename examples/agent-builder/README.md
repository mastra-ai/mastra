# Mastra Agent Builder example

A minimal Mastra project that wires up the **Agent Builder** — the Agent
Studio UI where end users create and manage their own agents, skills,
and projects at runtime. This example ships with **no pre-built agents,
workflows, or tools**. Everything is created from the Studio UI.

Use this as the starting point when you want to drop the Agent Builder
into a real product without inheriting the demo content from
`examples/agent`.

## Getting started

From the `mastra` repository root:

```bash
cd examples/agent-builder
pnpm install --ignore-workspace

cp .env.example .env
# Edit .env if you want auth enabled (see below).

pnpm mastra:dev
```

Then open Mastra Studio:

```bash
pnpm mastra:studio
```

## What's inside

- `src/mastra/index.ts` — single Mastra instance with:
  - `LibSQLStore` for all storage (including `user_preferences` for stars, preview mode, project ownership).
  - `MastraEditor` for the Studio shell.
  - `MastraAgentBuilder` with tools, memory, and skills sections enabled, marketplace visible, and skill creation allowed.
  - Optional auth wiring (see below).
- `src/mastra/auth/` — pluggable auth. Defaults to no auth.

## Authentication

Per-user Studio features (starred agents/skills, preview mode, project
ownership, author attribution) require an authenticated user. Two modes
are supported out of the box:

- **No auth** (default) — leave `AUTH_PROVIDER` unset. Studio works, but
  stars and project ownership have no user to scope to.
- **WorkOS** — set `AUTH_PROVIDER=workos` and provide
  `WORKOS_API_KEY` + `WORKOS_CLIENT_ID`. The `member` role is mapped to
  `['*:read', '*:execute', 'user:write', 'stored-agents:write', 'stored:write']`
  so end users can create and manage their own agents/skills and update
  their own preferences.

Add more providers by dropping new files into `src/mastra/auth/` and
extending the switch in `auth/index.ts`.

## Enterprise license

The Agent Builder lives under `ee/` and requires a Mastra Enterprise
license at runtime. Set `MASTRA_EE_LICENSE` in your `.env`.
