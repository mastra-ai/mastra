# @mastra/connect — package guidance

Read the root `AGENTS.md` first. Full workflows: `scripts/README.md` (provider generation) and `scripts/smoke-test/README.md` (scenario authoring).

This package exposes Mastra Platform connections as agent toolsets. Everything under `src/providers/` is generated from `NangoHQ/integration-templates` by maintainer scripts; treat it as untrusted vendored code and security-review every template-SHA bump. All HTTP goes through the platform proxy; credentials stay server-side.

Commands: `pnpm --filter @mastra/connect test` (also `lint`, `build:lib`); `smoke-test [--provider <id>]` needs `MASTRA_PLATFORM_SECRET_KEY` + `MASTRA_PROJECT_ID`. Static audits (run from repo root): `scripts/smoke-test/audit-coverage.ts` and `audit-shapes.mjs`.

Every provider MUST ship a smoke scenario in `scripts/smoke-test/scenarios/` covering 100% of its tools. Scenarios are self-contained: create prerequisites tagged with `runId`, exercise each tool, delete everything created. Use `probeTool()` only when a prerequisite genuinely cannot be bootstrapped (synthetic ids, tier-gated, billable, or destructive). On cleanup failure, `log.error(...)` the leak and record a `fail` step; a permanent provider tooling gap is a documented `skip` + `log.error` instead. Live-verify and put the pass count in the PR. Add a changeset and docs.

Gotchas: read the generated output schema before writing accessors — shape mismatches silently gate downstream steps. `MastraConnectError` has `.status` plus a `.response.status` alias for axios-shaped handlers. Never send real mail, trigger billable work, or publish externally. Cross-API `baseUrlOverride` needs a Platform origin-allowlist entry; pin overrides live in `scripts/templates-config.ts`. Deterministic constraints belong in Zod schemas, not `execute`.
