# `create-factory`

Create a Mastra Factory project:

```shell
npm create factory@latest
```

You can provide the project name directly:

```shell
npm create factory@latest -- my-factory
```

The package is a thin wrapper around the same CLI-owned implementation used by the namespaced command:

```shell
npx mastra factory create my-factory
```

By default, the command writes the immutable scaffold packaged with the `mastra` release and doesn't clone a remote template. The CLI build derives that scaffold from `mastracode/web`, using the workspace package versions assigned to the same release: stable versions become caret ranges, while intentional prereleases remain exact. Pass `--template <url>` only to use a custom Git template.

The command installs dependencies, optionally provisions Mastra Platform resources, and initializes Git. Run `npm create factory@latest -- --help` or `npx mastra factory create --help` for all options.

## Development

The Factory project-creation implementation, scaffold generator, Platform integration, and tests live in `packages/cli`. This package only configures analytics and delegates to `mastra/dist/commands/factory/command.js`, matching the `create-mastra` wrapper architecture.

```shell
pnpm --filter ./packages/cli test
pnpm --filter ./packages/cli typecheck
pnpm --filter create-factory check
pnpm --filter create-factory build
```

The CLI build generates `packages/cli/src/commands/factory/generated/scaffold/` from `mastracode/web` and includes it in the published `mastra` package. Generation fails if required source files, workspace package versions, or direct Mastra dependency mappings are missing. A published `mastra` release therefore contains the newest tested scaffold available when that release was built, not unreleased changes from the repository's main branch.

## License

Apache-2.0
