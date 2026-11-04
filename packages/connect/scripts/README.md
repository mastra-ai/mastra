# Provider generation

These commands are maintainer-only. They generate provider toolsets that are committed to `@mastra/connect`; package users don't run them.

## Typical workflow

```bash
pnpm --filter @mastra/connect sync-templates          # 1. fetch the pinned template checkout
pnpm --filter @mastra/connect list-providers --search hubspot  # 2. find the provider
pnpm --filter @mastra/connect add-provider hubspot    # 3. generate it
pnpm --filter @mastra/connect test                    # 4. verify
git add src/providers && git commit                   # 5. review the diff and commit
```

## Refresh the template checkout

The template source is pinned in `templates-config.ts` and cloned into the gitignored `.templates/` directory. Run this once before any `add-provider` invocation, and again whenever the pinned SHA changes.

```bash
pnpm --filter @mastra/connect sync-templates
```

A provider listed in `TEMPLATE_PIN_OVERRIDES` is generated from its own repository and commit instead of the shared pin. Pass the provider id to move the checkout to that pin first; `add-provider` refuses to generate from a checkout at any other commit.

```bash
pnpm --filter @mastra/connect sync-templates resend
```

## Find a provider

```bash
pnpm --filter @mastra/connect list-providers                   # every provider in the template catalog
pnpm --filter @mastra/connect list-providers --search linear   # filter the catalog by name
pnpm --filter @mastra/connect list-providers --installed       # providers currently committed to this package
```

Catalog entries show the number of action templates available; installed entries show tool count and how many actions were skipped at generation time.

## Add or update a provider

```bash
pnpm --filter @mastra/connect add-provider linear
pnpm --filter @mastra/connect add-provider gitlab --as gitlab-self-managed
```

`--as` changes the local integration ID, generated directory name, tool prefix, registry ID, and connection environment variable. It must not collide with another installed provider — collisions are a hard error.

Re-running the command for an installed provider shows a confirmation prompt before replacing it. If generated files have been hand-edited since the previous run (detected via manifest checksums), the prompt lists the changed paths so edits aren't silently lost. Use `--yes` only in a non-interactive environment where replacement is intentional.

The command writes:

- `src/providers/<localId>/tools/<action>.ts`: One generated tool module per action
- `src/providers/<localId>/tools.ts`: Provider factory and action exports
- `src/providers/<localId>/index.ts`: Registry self-registration
- `src/providers/<localId>/.manifest.json`: Template SHA, generated file checksums, tool count, and skipped actions
- `src/providers/index.ts`: Side-effect imports for every installed provider

Actions that need runtime helpers the platform proxy context doesn't implement, or contain unsupported top-level statements, are skipped with a per-action reason printed and recorded in the manifest.

Treat generated source as untrusted vendored code. Every template SHA update and generated diff requires security review before commit; passing automated checks is not sufficient.

Provider responses that carry credentials an agent never needs, such as webhook signing secrets, are listed per action in `OUTPUT_SECRET_FIELDS` in `generate-provider.ts`. The generated tool removes those fields from its result and omits them from its output schema, and `src/__tests__/provider-actions.test.ts` covers the redaction.

Templates that read `connection.credentials` get their `getConnection()` calls rewritten to `getConnectionWithCredentials()`, which fetches the raw credential from the platform's credential endpoint (the same one `credential()` uses). Every other exec receives a connection context without credentials, so only actions that genuinely need the secret ever see it.

Some templates follow an input value as a raw proxy endpoint, such as a Microsoft Graph `@odata.nextLink` cursor. List those fields per action in `INPUT_FIELD_PATTERNS` in `generate-provider.ts`, keyed by `<providerId>/<actionSlug>`, with the pattern a legitimate value must match. The generated tool re-declares each field as `z.string().regex(...)`, so the constraint appears in the JSON schema the model sees and a value for any other endpoint fails validation before the proxy is called. `src/__tests__/microsoft-excel-cursors.test.ts` covers the Excel cursors.

Generated code never references the upstream SDK: exec bodies receive a `platformProxy` context (`PlatformProxy` in `src/runtime/platform-proxy.ts`) that routes every request through the Mastra platform's `/v2/proxy` endpoint. Provider-specific generator overrides can also attach model-output adapters when raw provider output needs a safer model-facing representation, such as image data that should be sent as multimodal content instead of JSON text.

## Remove a provider

```bash
pnpm --filter @mastra/connect remove-provider linear
```

Removal always requires confirmation (`--yes` to skip). The command warns when generated files have diverged from their manifest, deletes the provider directory, and regenerates `src/providers/index.ts`.

## Verify generated code

```bash
pnpm --filter @mastra/connect test
pnpm --filter @mastra/connect lint
pnpm --filter @mastra/connect build:lib
```

Generated action implementations are adapted from `NangoHQ/integration-templates` (Elastic License 2.0). Keep `packages/connect/NOTICE.md` and each generated source header intact.

## Generate provider documentation

```bash
pnpm --filter @mastra/connect generate:provider-docs
```

This also runs as part of the package `build` task. `generate-provider-docs.ts` reads tool IDs and descriptions from `src/providers`, combines them with the curated metadata in `provider-docs-metadata.ts`, writes the documentation files listed below, and then formats exactly those files with the docs package's `oxfmt-mdx`. It doesn't format or delete any other file.

- `docs/src/content/en/reference/connect/providers.mdx`: The full tool list for every published toolset. Providers in `EXCLUDED_PROVIDERS` are left out.
- `docs/src/content/en/integrations/<canonicalPage>`: A complete integration page for each provider with `ownership: 'generated-page'` and `emit: true`.
- `docs/src/components/connect/generated/<provider-id>.mdx`: A partial with an `### Agent tools` section for each provider with `ownership: 'handwritten-with-partial'` and `emit: true`. The handwritten integration page imports it under its `## Connect` section. Partials have no frontmatter and no route.

`provider-docs-metadata.ts` is the only place to change display names, logos, notes, summaries, canonical pages, and ownership. Every generated file starts with a marker comment. Don't edit generated files; change the metadata or the templates in `provider-docs-lib.ts` and regenerate. The generator refuses to overwrite an existing file without the marker, refuses paths outside the outputs above, and rejects two providers that claim the same page.

When you add an emitted page, set its `category` in the metadata, add it to that category in `docs/src/content/en/integrations/sidebars.js`, and add it to the provider grid on `docs/src/content/en/docs/mastra-platform/connect.mdx`. The generator doesn't edit sidebars, and a test checks that each page's `category` matches the sidebar.

To give a generated page handwritten content, such as a self-managed setup section, change the provider's `ownership` to `'handwritten-with-partial'` and regenerate to create the partial. Then remove the marker comment from the existing page, replace its generated `### Connect an account` and `### Add tools to an agent` sections with the imported partial, and add your content.

`src/__tests__/provider-docs.test.ts` runs the generator against temporary directories and checks that the metadata covers every published toolset exactly once. Typecheck the scripts with:

```bash
pnpm --filter @mastra/connect exec tsc --noEmit -p tsconfig.provider-docs.json
```

## Pending provider contributions

Resend and incident.io are generated from the contribution branches under review in NangoHQ/integration-templates PRs [#667](https://github.com/NangoHQ/integration-templates/pull/667) and [#668](https://github.com/NangoHQ/integration-templates/pull/668). Slack, GitHub, Google Mail, Google Calendar, Fireflies, PostHog, Stripe, Discord, Twitter/X, and HubSpot are generated from the head commit of [#677](https://github.com/NangoHQ/integration-templates/pull/677), which is upstream main plus agent-focused gap actions; they share one pin in `TEMPLATE_PIN_OVERRIDES`. That pin names the upstream repository directly — GitHub serves a PR's head commit from the base repository, so no fork remote is involved. The shared pin stays on the upstream repository and every other provider is generated from it.

```sh
pnpm --filter @mastra/connect sync-templates resend
pnpm --filter @mastra/connect add-provider resend --yes
pnpm --filter @mastra/connect sync-templates incident-io
pnpm --filter @mastra/connect add-provider incident-io --yes
```

After both PRs merge, delete the overrides, move the shared pin to an upstream revision that contains them, sync, regenerate the providers, and review manifest/checksum changes. Sync updates an existing cache's remote when the repository pin changes. Older manifests without `templateRepo` refer to NangoHQ/integration-templates.
