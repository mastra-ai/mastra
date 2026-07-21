# create-factory

Scaffolding CLI for the **Mastra Software Factory** — an open-source, agent-powered software delivery environment built on [Mastra](https://mastra.ai).

```bash
npm create factory
```

The CLI is intentionally minimal: it asks for a project name, clones the [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template), installs dependencies, and initializes git. That's it — run `npm run dev` and finish setup (model providers, integrations, database) from the web UI on first load. An "auth with the Mastra platform" step is planned as a follow-up.

## Flags

```text
npm create factory [project-name] -- [options]

    --default              Non-interactive: default name
    --template-ref <ref>   Pin a template repo tag/branch
    --template-dir <dir>   Use a local template directory (development)
-t, --timeout [ms]         Timeout for dependency installation
```

## Development (monorepo)

This package lives in the `mastra-ai/mastra` monorepo at `mastracode/mastra-factory`. Releases go through the monorepo's changesets release train (it is un-ignored in `.changeset/config.json`) — add a changeset with your change and the train versions and publishes it.

```bash
pnpm --filter ./mastracode/mastra-factory build   # bundle src -> dist
pnpm --filter ./mastracode/mastra-factory test    # vitest
node bin/cli.mjs my-app --default --template-dir ./template-out
```

### Template sync

`scripts/sync-template.mjs` generates the template tree from `mastracode/web`:

- `link:` deps → caret ranges on published versions (anchored on local monorepo versions by default, verified on npm; `--tag latest` for stable dist-tags)
- monorepo tsconfig → standalone, test files/deps stripped, user-facing scripts
- checked-in `template/README.md` → user-facing README (version tokens filled at sync)
- `.env.schema` → `.env.example` (varlock decorators removed)

Syncing to [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template) is automated, mirroring the `templates/*` process: the `sync-softwarefactory-template` workflow regenerates the template using published local monorepo versions and force-pushes it on every push to `main` that touches `mastracode/web`, the sync script, or `template/README.md`. The monorepo is the source of truth — direct commits to the template repo get overwritten.

```bash
node scripts/sync-template.mjs            # writes ./template-out (local development)
```

## License

Apache-2.0
