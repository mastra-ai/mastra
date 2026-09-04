# `create-factory`

`create-factory` scaffolds a Mastra Factory project.

```shell
npm create factory
```

It clones the public [`softwarefactory-template`](https://github.com/mastra-ai/softwarefactory-template), installs dependencies, and initializes Git. Run `npm create factory -- --help` for options.

Optional Mastra platform setup writes provisioned credentials and resource identifiers to `.env`.

Pass `--no-platform` to skip platform provisioning. This leaves the template `.env` unchanged.

## Development

This package owns prompts, template cloning, package-manager detection, optional Mastra platform setup, dependency installation, and Git initialization.

```shell
pnpm --filter create-factory test
pnpm --filter create-factory check
pnpm --filter create-factory lint
pnpm --filter create-factory build
```

Generated project behavior belongs to the separate template repository.

## License

Apache-2.0
