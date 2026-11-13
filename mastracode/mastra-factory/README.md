# create-factory

Mastra Factory is an open source environment for building software with coding agents. Connect your repository to turn issues into plans, implementations, and reviewed pull requests.

`create-factory` is the recommended way to scaffold your Mastra Factory. By default,

## Installation

> [!IMPORTANT]
> Make sure that you have Node.js 22.13.0 or later installed on your system.

Run the latest version directly with your package manager.

Using npm:

```bash
npx create-factory@latest
```

Using Yarn:

```bash
yarn dlx create-factory@latest
```

Using pnpm:

```bash
pnpm create factory@latest
```

## Usage

The interactive setup asks where to create the project and helps configure your Mastra Factory project. Run it in an empty directory and press Enter at the name prompt (or pass `.` as the project name) to set up the project in the current directory.

By default, the setup wizard scaffolds the [platform template](https://github.com/mastra-ai/template-factory) and provisions Mastra platform resources during setup, enabling you to fully run Mastra Factory on platform or locally with cloud-backed capabilities. If you prefer to [self-host](https://factory.mastra.ai/deployment#self-host) Mastra Factory, run the setup with the `--no-platform` flag. It scaffolds the [self-hosted template](https://github.com/mastra-ai/template-factory-self-hosted) instead, which uses PostgreSQL, WorkOS, a GitHub App, and local sandboxes. Either way, the setup writes a freshly generated `FACTORY_CREDENTIAL_ENCRYPTION_KEY` to `.env` when the template uses one, so stored credentials are encrypted from the first start.

```bash
npx create-factory@latest my-mastra-factory --no-platform
```

All input can be passed as command-line args instead:

```bash
npx create-factory@latest --name acme-factory --org my-org --region eu
```

Pass `--help` to see all options:

```bash
npx create-factory@latest --help
```

Platform projects are created in the US region by default. To create the project in the EU instead, pass `--region eu`:

```bash
npx create-factory@latest my-mastra-factory --region eu
```

## Documentation

- [create-factory CLI reference](https://factory.mastra.ai/reference/create-factory)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/mastra-factory/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
