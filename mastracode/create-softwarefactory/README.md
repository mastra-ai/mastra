# create-softwarefactory

Scaffolding CLI for the **Mastra Software Factory** — an open-source, agent-powered software delivery environment built on [Mastra](https://mastra.ai).

```bash
npm create softwarefactory
```

The CLI clones the [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template), walks you through configuration (model provider, database, WorkOS sign-in, optionally a GitHub App and Linear), writes a ready-to-run `.env`, and installs dependencies. Everything is skippable — the app boots with zero configuration in local mode, and anything skipped can be finished later from the web UI settings or `.env`.

## Flags

```text
npm create softwarefactory [project-name] -- [options]

-l, --llm <provider>       Model provider (openai or anthropic)
-k, --llm-api-key <key>    API key for the model provider
    --db-url <url>         Postgres connection URL (postgres://...)
    --default              Quick start: Docker database defaults, skip integrations
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
