# create-softwarefactory

Scaffolding CLI for the **Mastra Software Factory** — an open source, agent-powered software delivery environment built on [Mastra](https://mastra.ai).

```bash
npm create softwarefactory
```

The CLI clones the [softwarefactory-template](https://github.com/mastra-ai/softwarefactory-template), walks you through configuration (model provider, database, WorkOS sign-in, GitHub App via the manifest flow, optionally Linear), writes a ready-to-run `.env`, and installs dependencies. Everything is skippable — the app boots with zero configuration in local mode, and anything skipped can be finished later from the web UI settings or `.env`.

## Flags

```
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

This package lives in the `mastra-ai/mastra` monorepo at `mastracode/create-softwarefactory` and is published manually (it is excluded from the changeset release train).

```bash
pnpm --filter ./mastracode/create-softwarefactory build   # bundle src -> dist
pnpm --filter ./mastracode/create-softwarefactory test    # vitest
node bin/cli.mjs my-app --default --template-dir ./template-out
```

### Template sync

`scripts/sync-template.mjs` generates the template tree from `mastracode/web`:

- `link:` deps → exact published versions (local monorepo versions by default, verified on npm; `--tag latest` for stable dist-tags)
- monorepo tsconfig → standalone, test files/deps stripped, user-facing README/scripts
- `.env.schema` → `.env.example` (varlock decorators removed)

```bash
node scripts/sync-template.mjs            # writes ./template-out
cd template-out && git init ...           # review, push to the template repo, tag
```

## License

Apache-2.0
