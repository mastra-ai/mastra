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
pnpm --filter @mastra/connect add-provider gitlab --as gitlab-group-token
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

## Pending provider contributions

Resend and incident.io are generated from the contribution branches under review in NangoHQ/integration-templates PRs [#667](https://github.com/NangoHQ/integration-templates/pull/667) and [#668](https://github.com/NangoHQ/integration-templates/pull/668). Each has its own entry in `TEMPLATE_PIN_OVERRIDES`, so the shared pin stays on the upstream repository and every other provider is generated from it.

```sh
pnpm --filter @mastra/connect sync-templates resend
pnpm --filter @mastra/connect add-provider resend --yes
pnpm --filter @mastra/connect sync-templates incident-io
pnpm --filter @mastra/connect add-provider incident-io --yes
```

After both PRs merge, delete the overrides, move the shared pin to an upstream revision that contains them, sync, regenerate the providers, and review manifest/checksum changes. Sync updates an existing cache's remote when the repository pin changes. Older manifests without `templateRepo` refer to NangoHQ/integration-templates.
