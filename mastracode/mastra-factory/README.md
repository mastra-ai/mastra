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

By default, `create-factory` writes the scaffold packaged with its release. The scaffold uses an explicit set of compatible stable Mastra package ranges and doesn't clone a remote template. Pass `--template <url>` only to use a custom Git template.

The command installs dependencies, optionally provisions Mastra Platform resources, and initializes Git. Run `npm create factory@latest -- --help` or `npx mastra factory create --help` for all options.

## Development

The shared Factory project-creation implementation, packaged scaffold, Platform integration, and tests live in this package. The `mastra` CLI consumes the reusable `create-factory/command` API to register `mastra factory create`.

```shell
pnpm --filter create-factory check
pnpm --filter create-factory lint
pnpm --filter create-factory test
pnpm --filter create-factory build
```

The readable scaffold assets live in `scaffold/`. Review the scaffold source and its dependency ranges together whenever either changes.

## License

Apache-2.0
