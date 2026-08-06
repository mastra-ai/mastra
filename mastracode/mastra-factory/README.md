# `create-factory`

Scaffold a Mastra Factory project with the Mastra CLI:

```shell
mastra factory init
```

You can also provide the project name directly:

```shell
mastra factory init my-factory
```

The existing `npm create factory` command remains available as a compatibility wrapper and supports the same arguments:

```shell
npm create factory -- my-factory
```

The command clones the public [`softwarefactory-template`](https://github.com/mastra-ai/softwarefactory-template), installs dependencies, optionally provisions Mastra Platform resources, and initializes Git. Run `mastra factory init --help` for options.

## Development

The shared Factory initialization implementation and tests live in `packages/cli/src/commands/factory`. This package provides the `create-factory` compatibility entry point.

```shell
pnpm --filter create-factory check
pnpm --filter create-factory lint
pnpm --filter create-factory build
```

Generated project behavior belongs to the separate template repository.

## License

Apache-2.0
