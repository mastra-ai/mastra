---
'mastracode': minor
---

Added optional GitHub App integration to the MastraCode web UI. When the GitHub App environment variables (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_SLUG, APP_DATABASE_URL) are set alongside WorkOS auth, signed-in users can install/connect the GitHub App, pick repositories they have access to, and turn each repo into a project. Repo selections and project metadata are stored per user in a separate application Postgres via Drizzle ORM.

GitHub-backed projects are materialized into an isolated cloud sandbox (a MastraSandbox such as RailwaySandbox) on open: the server provisions or reattaches the project's sandbox, clones (or pulls) the repo inside it using a short-lived installation token that never reaches the browser, and the agent operates entirely against the sandbox checkout via a sandbox-backed filesystem and command execution. Opening a GitHub project requires a configured sandbox provider (RAILWAY_API_TOKEN / RAILWAY_ENVIRONMENT_ID); without one, connecting and picking repos still works but opening shows a clear "sandbox not configured" error.

When the GitHub App variables are absent the feature is a no-op: no GitHub UI is shown and local-path projects work exactly as before.
