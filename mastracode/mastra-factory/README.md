# `create-factory`

Create a Mastra Factory project:

```shell
npm create factory@latest
```

You can provide the project name directly:

```shell
npm create factory@latest -- my-factory
```

The namespaced Mastra CLI command delegates to the same Factory-owned implementation and supports the same arguments:

```shell
npx mastra factory create my-factory
```

By default, `create-factory` writes the immutable scaffold packaged with its release and doesn't clone a remote template. The package build derives that scaffold from `mastracode/web`, using the workspace package versions assigned to the same release: stable versions become caret ranges, while intentional prereleases remain exact. Pass `--template <url>` only to use a custom Git template.

The command installs dependencies, optionally provisions Mastra Platform resources, and initializes Git. Run `npm create factory@latest -- --help` or `npx mastra factory create --help` for all options.

## Development

The shared Factory project-creation implementation, scaffold generator, Platform integration, and tests live in this package. The `mastra` CLI consumes the reusable `create-factory/command` API to register `mastra factory create`.

```shell
pnpm --filter create-factory check
pnpm --filter create-factory lint
pnpm --filter create-factory test
pnpm --filter create-factory build
```

The build generates `generated/scaffold/` from `mastracode/web` and includes that ignored output in the npm package. Generation fails if required source files, workspace package versions, or direct Mastra dependency mappings are missing. A published `create-factory` release therefore contains the newest tested scaffold available when that release was built, not unreleased changes from the repository's main branch.

## License

Apache-2.0
