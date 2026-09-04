# `create-factory`

`create-factory` scaffolds a Mastra Factory project.

```shell
npm create factory
```

It clones the public [`softwarefactory-template`](https://github.com/mastra-ai/softwarefactory-template), installs dependencies, and initializes Git. Run `npm create factory -- --help` for options.

Optional Mastra platform setup writes provisioned credentials and resource identifiers to `.env`. It also writes a non-secret `.mastra-project.json` containing the project and organization identifiers used by commands such as `mastra api factory project list` to resolve the hosted Factory instance and authenticate automatically.

Pass `--no-platform` to skip platform provisioning. This leaves the template `.env` unchanged and doesn't create `.mastra-project.json`.

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
