# @mastra/connect — package guidance

See the root `AGENTS.md` first; this file layers package-specific rules on top.

## What this package is

`@mastra/connect` exposes Mastra Platform integration connections as agent toolsets. Every provider under `src/providers/<provider>/` is **generated code** adapted from `NangoHQ/integration-templates` (Elastic License 2.0). Users do not run the generation scripts — only maintainers do.

- Runtime: `src/runtime/platform-proxy.ts` is the only HTTP surface. All provider tools route through the Mastra Platform `/v2/proxy` endpoint; generated code never imports the upstream SDK.
- Resolution: `src/tools.ts` + `src/resolution.ts` map a project's connected integrations to a live tool set.
- Credentials: tool execs receive a `platformProxy` context with no credentials by default; actions that need the raw secret have their `getConnection()` rewritten to `getConnectionWithCredentials()` at generation time.
- Secret redaction: `OUTPUT_SECRET_FIELDS` in `scripts/generate-provider.ts` strips credential-bearing fields from tool output and output schemas; `src/__tests__/provider-actions.test.ts` covers it.
- Treat all generated source as **untrusted vendored code**. Every template-SHA bump and generated diff needs security review before commit — automated checks are not sufficient.

## Common commands

```bash
# unit + type checks (always run before pushing changes to this package)
pnpm --filter @mastra/connect test
pnpm --filter @mastra/connect lint
pnpm --filter @mastra/connect build:lib

# provider generation (maintainer-only; see scripts/README.md)
pnpm --filter @mastra/connect sync-templates          # refresh pinned template checkout
pnpm --filter @mastra/connect list-providers          # browse catalog / installed providers
pnpm --filter @mastra/connect add-provider <id>       # generate (or regenerate) a provider
pnpm --filter @mastra/connect remove-provider <id>    # delete a provider

# live smoke suite (requires MASTRA_PLATFORM_SECRET_KEY + MASTRA_PROJECT_ID)
pnpm --filter @mastra/connect smoke-test
pnpm --filter @mastra/connect smoke-test --provider <id>
tsx packages/connect/scripts/smoke-test/audit-coverage.ts   # static coverage audit
```

Prefer the `--filter` form over root-level scripts. Fresh clones generally need `pnpm install` and a build of workspace dependencies before unit tests pass.

## Adding or regenerating a provider

Every new provider added to `src/providers/<provider>/` MUST ship with an accompanying end-to-end smoke test in `scripts/smoke-test/scenarios/<provider>.ts` that exercises **all** of the provider's tools.

A new-provider PR is not complete until:

1. **Scenario file exists** at `packages/connect/scripts/smoke-test/scenarios/<provider>.ts` and is registered alphabetically in `scripts/smoke-test/scenarios/index.ts`.
2. **100% tool coverage** — the audit script (`tsx packages/connect/scripts/smoke-test/audit-coverage.ts`) reports `<provider>: N/N (100%)`. Every tool the provider ships must appear in the scenario's step list, invoked through the public tools resolver (not direct SDK calls).
3. **Self-contained lifecycle** — the scenario creates its own prerequisite resources (tagged with the `runId` helper), exercises each tool, and deletes everything it created. Follow the existing CRUD patterns in `linear.ts`, `notion.ts`, and `hubspot.ts`. Use `probeTool()` from `scenario.ts` **only** for operations that genuinely cannot create their own prerequisites (synthetic ids, product-tier-gated endpoints, operations that touch real recipients or billable resources).
4. **Cleanup is unconditional** — wrap every post-create step in `try/catch`. On cleanup failure call `log.error(...)` naming the leaked record so operators can delete it by hand, and record the step as `fail` (not `skip`).
5. **Live-verified** — run `pnpm --filter @mastra/connect smoke-test --provider <id>` against a real test project and include the pass count in the PR description. If any tool legitimately cannot run end-to-end in a smoke environment, downgrade it to a `probeTool()` call with an inline comment explaining why.
6. **Changesets + docs** — add a changeset per the repo convention (`@.mastracode/commands/changeset.md`) and document the provider in docs/ following the mastra-docs skill.

The smoke suite is the primary regression gate for @mastra/connect — a provider shipping without one leaves its tools untested against the real Platform proxy.

See `scripts/README.md` (generation) and `scripts/smoke-test/README.md` (scenario authoring, output format, cross-provider cleanup) for the full workflows.

## Working on scenarios

- `integrationId` must match the platform catalog id exactly (lowercase, hyphenated: `google-sheet`, not `googleSheet`).
- Short-circuit with `requireTools(tools, [...])` first — a missing tool should produce a `skip` step, not throw.
- Embed `runId` (format `mastra-smoke-<slug>`) in every record title so concurrent runs don't collide and leaked records are visibly tagged.
- `tools` is the current provider's toolset; `allTools` is the full project toolset. Use `allTools` when another provider owns the delete endpoint (e.g. `google_drive_delete_file` cleans up a sheet created by `google-sheet`).
- Never send mail to real recipients, trigger billable workflows (CI runs, LLM batch jobs), or publish externally. Probe those endpoints.
- Response shapes come from the generated tool, not the upstream REST schema — check `src/providers/<id>/tools/<action>.ts` for the real output before writing `.commit?.sha`-style accessors. Response-shape mismatches silently gate out downstream steps.
- Error shape: `platformProxy` throws `MastraConnectError` with `.status` at the top level, not nested under `.response.status`. Generated error handlers that expect axios shape may need patching.

## Known upstream / platform quirks

- **`baseUrlOverride` cross-API routing** is gated by the Platform's per-integration allowlist (`services/integration-routes/src/integrations.ts` `connectionContextAllowsOrigin`). Providers that call a sibling API under the same OAuth scope (e.g. google-docs → Drive API) require an entry in the Platform's `INTEGRATION_PROXY_ORIGINS` map, not a scenario or template fix.
- **Nango `connection_config` bare-hostname fields** (e.g. Supabase `projectUrl`) are normalized to `https://` origins by the Platform's `toHttpsOrigin()` helper — only field names ending in `url`/`host`/`hostname`/`domain`/`endpoint`/`origin` get the bare-hostname fallback.
- **Null-response schemas**: several upstream templates use strict `.parse()` on endpoints that return `null` for empty state (Gmail `list_filters`, Gmail `update_pop_settings`, etc.). Patch pattern is `.nullish()` + `safeParse()`; file upstream fixes against `NangoHQ/integration-templates`.
- **Deprecated upstream pins** live in `TEMPLATE_PIN_OVERRIDES` in `scripts/templates-config.ts`. See `scripts/README.md` "Pending provider contributions" for the current fork/PR situation.

## Deterministic input/output

Per the root convention, put deterministic constraints (shape, types, ranges, formats, cross-field invariants) in Zod schemas, not in `execute`. Keep runtime/external checks (authorization, existence, conflicts, upstream API responses) in `execute`. Generated tools follow this; preserve it in handwritten overrides.
