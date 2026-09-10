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

The interactive setup asks where to create the project and helps configure your Mastra Factory project.

By default, the setup wizard provisions Mastra platform resources during setup, enabling you to fully run Mastra Factory on platform or locally with cloud-backed capabilities. If you prefer to [self-host]() Mastra Factory, run the setup with the `--no-platform` flag.

```bash
npx create-factory@latest -- --no-platform
```

Pass `--help` to see all options:

```bash
npx create-factory@latest --help
```

## Documentation

- [create-factory CLI reference](https://mastra.ai/reference/cli/create-factory)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/mastra-factory/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
