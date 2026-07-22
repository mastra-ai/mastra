---
'create-factory': patch
---

Added platform sign-in, project creation, and Neon Postgres provisioning to the `create factory` CLI. After scaffolding, the CLI:

- Signs the user in via the existing Mastra browser-auth flow.
- Creates a Mastra platform server project in the chosen organization.
- Mints an `sk_` organization API key scoped to the new factory.
- Attaches and provisions a Neon Postgres database.
- Writes `MASTRA_SHARED_API_URL`, `MASTRA_ORGANIZATION_ID`, `MASTRA_PROJECT_ID`, `MASTRA_PLATFORM_SECRET_KEY`, and `DATABASE_URL` to the project's `.env`.

The result is a locally-runnable factory that can talk to the Mastra platform on first `npm run dev` without any manual configuration.

**New flags:**

- `--no-platform` — skip the platform round-trip; useful when iterating on the template offline.
- `--region <region>` — pass a specific Neon region id through to the platform.
