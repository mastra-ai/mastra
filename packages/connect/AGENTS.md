# @mastra/connect — package guidance

Read the root `AGENTS.md` first. Full workflows: `scripts/README.md` (provider generation) and `scripts/smoke-test/README.md` (scenario authoring).

`@mastra/connect` exposes Mastra Platform connections as agent toolsets. Everything under `src/providers/<provider>/` is generated from `NangoHQ/integration-templates` (Elastic License 2.0) by maintainer scripts (`sync-templates`, `add-provider`, `remove-provider`). Treat generated source as untrusted vendored code — every template-SHA bump needs security review. All HTTP goes through `src/runtime/platform-proxy.ts` (Platform `/v2/proxy`); credentials stay server-side unless a tool was rewritten to `getConnectionWithCredentials()` at generation time. `OUTPUT_SECRET_FIELDS` in `scripts/generate-provider.ts` redacts secrets from tool outputs.

```bash
pnpm --filter @mastra/connect test   # also: lint, build:lib
pnpm --filter @mastra/connect smoke-test [--provider <id>]  # needs MASTRA_PLATFORM_SECRET_KEY + MASTRA_PROJECT_ID
tsx packages/connect/scripts/smoke-test/audit-coverage.ts   # static 100%-coverage audit
node packages/connect/scripts/smoke-test/audit-shapes.mjs   # input-shape audit
```

Every provider MUST ship a smoke scenario at `scripts/smoke-test/scenarios/<provider>.ts` (registered alphabetically in `scenarios/index.ts`) covering 100% of its tools per `audit-coverage.ts`. Scenarios are self-contained: create prerequisites tagged with `runId`, exercise each tool, delete everything created. Use `probeTool()` only when a prerequisite genuinely cannot be bootstrapped (synthetic ids, tier-gated endpoints, real recipients, billable or destructive operations). On cleanup failure, `log.error(...)` the leaked record and record a `fail` step. Live-verify with `smoke-test --provider <id>` and put the pass count in the PR. Add a changeset and docs.

Scenario gotchas: read the generated tool's output schema before writing accessors — shape mismatches silently gate downstream steps. `MastraConnectError` carries `.status` top-level, plus a `.response.status` alias for axios-shaped template handlers. Never send real mail, trigger billable work, or publish externally.

Quirks: cross-API `baseUrlOverride` needs a Platform per-integration origin-allowlist entry; upstream templates that `.parse()` null bodies need the `.nullish()` + `safeParse()` patch filed upstream; template pin overrides live in `scripts/templates-config.ts`.

Deterministic constraints belong in Zod schemas, not `execute`; runtime/external checks stay in `execute`.
