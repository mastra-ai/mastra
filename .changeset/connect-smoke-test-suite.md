---
'@mastra/connect': minor
---

Add an end-to-end smoke test suite for `@mastra/connect` that reads `MASTRA_PLATFORM_SECRET_KEY` and `MASTRA_PROJECT_ID` from the environment, resolves the full project toolset through the public `tools()` resolver, and dispatches to per-provider scenarios that run a `create → read → update → delete` lifecycle through the available tools (no backdoor cleanup).

Run with:

```bash
pnpm --filter @mastra/connect smoke-test [--provider <id>]... [--project-id <id>]
```

This change ships the runner, CLI, scenario interface, reporter, static audit scripts (`audit-coverage.ts` for 100% tool coverage, `audit-shapes.mjs` for input-shape validation), and scenarios for all 26 checked-in providers. See `packages/connect/scripts/smoke-test/README.md` for how to add scenarios.

It also includes runtime changes surfaced by running the suite live:

- **Error details**: `extractProblemDetail` now also extracts the first human-readable message from `{ errors: [{ message, long_message }] }` payloads (Clerk, Linear's GraphQL envelope, Nango v2), preferring `long_message`. Provider error messages may therefore become more specific.
- **Axios-compatible error alias**: `MastraConnectError` now exposes its HTTP status under `response.status` as well as `status`. Generated provider tools come from upstream Nango templates whose error handlers check the axios-shaped `error.response.status`; without the alias those handlers (e.g. the expected-404 path in `github_create_or_update_file`) re-threw instead of recovering.
- **Clerk provider regenerated** from the upstream template fix (NangoHQ/integration-templates#670). Breaking tool-contract changes:
  - `clerk_list_sessions` now requires `client_id` or `user_id` (filtering by `status` alone is no longer accepted by the input schema) and no longer returns `total` in its output.
  - `clerk_create_user` now requires at least one identifier (`email_address`, `phone_number`, or `username`) via schema validation.
  - `clerk_list_users` issues an additional count request to populate `total`.
