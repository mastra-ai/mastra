# `create-factory`

`create-factory` scaffolds a Mastra Factory project.

```shell
npm create factory
```

It writes the Factory scaffold bundled with the Mastra CLI, installs dependencies, and initializes Git. Pass `--template <url>` to use a custom Git repository instead. Run `npm create factory -- --help` for options.

## Development

This package is a standalone wrapper around `mastra factory create`. The shared implementation owns prompts, custom template cloning, package-manager detection, optional Mastra platform setup, dependency installation, and Git initialization.

```shell
pnpm --filter create-factory test
pnpm --filter create-factory check
pnpm --filter create-factory lint
pnpm --filter create-factory build
```

Generated project behavior is defined by the Factory scaffold bundled with the `mastra` package.

## License

Apache-2.0
