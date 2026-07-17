# create-softwarefactory

Scaffolding CLI for the **Mastra Software Factory** — an open-source, agent-powered software delivery environment built on [Mastra](https://mastra.ai).

```bash
npm create softwarefactory
```

The CLI is intentionally minimal: it asks for a project name, clones the [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template), installs dependencies, and offers to initialize git. That's it — run `npm run dev` and finish setup (model providers, integrations, database) from the web UI on first load. An "auth with the Mastra platform" step is planned as a follow-up.

## Flags

```text
npm create softwarefactory [project-name] -- [options]

    --default              Non-interactive: default name, init git
    --template-ref <ref>   Pin a template repo tag/branch
    --template-dir <dir>   Use a local template directory (development)
-t, --timeout [ms]         Timeout for dependency installation
```

## Development (monorepo)

This package lives in the `mastra-ai/mastra` monorepo at `mastracode/create-softwarefactory`. Releases go through the monorepo's changesets release train (it is un-ignored in `.changeset/config.json`) — add a changeset with your change and the train versions and publishes it.

```bash
pnpm --filter ./mastracode/create-softwarefactory build   # bundle src -> dist
pnpm --filter ./mastracode/create-softwarefactory test    # vitest
node bin/cli.mjs my-app --default --template-dir ./template-out
```

### Template sync

`scripts/sync-template.mjs` generates the template tree from `mastracode/web`:

- `link:` deps → caret ranges on published versions (anchored on local monorepo versions by default, verified on npm; `--tag latest` for stable dist-tags)
- monorepo tsconfig → standalone, test files/deps stripped, user-facing README/scripts
- `.env.schema` → `.env.example` (varlock decorators removed)

Syncing to [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template) is automated, mirroring the `templates/*` process: the `sync-softwarefactory-template` workflow regenerates the template (`--tag latest`) and force-pushes it on every push to `main` that touches `mastracode/web` or the sync script. The monorepo is the source of truth — direct commits to the template repo get overwritten.

```bash
node scripts/sync-template.mjs            # writes ./template-out (local development)
```

## License

Apache-2.0
