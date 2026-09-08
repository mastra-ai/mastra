# Provider generation

These commands are maintainer-only. They generate provider toolsets that are committed to `@mastra/connect`; package users don't run them.

## Refresh the template checkout

The template source is pinned in `templates-config.ts` and cloned into the gitignored `.templates/` directory.

```bash
pnpm --filter @mastra/connect sync-templates
```

## Find a provider

```bash
pnpm --filter @mastra/connect list-providers
pnpm --filter @mastra/connect list-providers --search linear
pnpm --filter @mastra/connect list-providers --installed
```

## Add or update a provider

```bash
pnpm --filter @mastra/connect add-provider linear
pnpm --filter @mastra/connect add-provider gitlab --as gitlab-group-token
```

`--as` changes the local integration ID, generated directory name, tool prefix, registry ID, and connection environment variable. It must not collide with another installed provider.

Re-running the command for an installed provider shows a confirmation prompt before replacing it. If generated files have changed since the previous run, the prompt lists the changed paths. Use `--yes` only in a non-interactive environment where replacement is intentional.

The command writes:

- `src/providers/<localId>/tools/<action>.ts`: One generated tool module per action
- `src/providers/<localId>/tools.ts`: Provider factory and action exports
- `src/providers/<localId>/index.ts`: Registry self-registration
- `src/providers/<localId>/.manifest.json`: Template SHA, generated file checksums, tool count, and skipped actions
- `src/providers/index.ts`: Side-effect imports for every installed provider

Review skipped actions and generated diffs before committing. The generator currently accepts actions that can run through the local Nango-compatible proxy shim.

## Remove a provider

```bash
pnpm --filter @mastra/connect remove-provider linear
```

Removal always requires confirmation. The command warns when generated files have diverged from their manifest, deletes the provider directory, and regenerates `src/providers/index.ts`.

## Verify generated code

```bash
pnpm --filter @mastra/connect test
pnpm --filter @mastra/connect lint
pnpm --filter @mastra/connect build:lib
```

Generated action implementations are adapted from `NangoHQ/integration-templates`. Keep `packages/connect/NOTICE.md` and each generated source header intact.
