---
'@mastra/connect': minor
---

Add an end-to-end smoke test suite for `@mastra/connect` that reads `MASTRA_PLATFORM_SECRET_KEY` and `MASTRA_PROJECT_ID` from the environment, resolves the full project toolset through the public `tools()` resolver, and dispatches to per-provider scenarios that run a `create → read → update → delete` lifecycle through the available tools (no backdoor cleanup).

Run with:

```bash
pnpm --filter @mastra/connect smoke-test [--provider <id>]... [--project-id <id>]
```

This change ships the runner, CLI, scenario interface, reporter, and initial scenarios for `linear`, `notion`, and `google-sheet`. Providers without a registered scenario surface as `SKIP: no scenario` in the report so coverage gaps are visible — follow-up commits will fill in the remaining providers. See `packages/connect/scripts/smoke-test/README.md` for how to add scenarios.
