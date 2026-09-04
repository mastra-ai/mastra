# Mastra CLI

Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack.

The `mastra` package is Mastra's command-line interface. Use it to initialize projects, run the local development server and Studio, build production output, start built applications, deploy supported projects, manage environment variables, run migrations, and work with evaluations and scorers.

## Installation

Install the CLI globally to use `mastra` from any directory:

```bash
npm install --global mastra
```

If you prefer not to install packages globally, run it through `npx`:

```bash
npx mastra --help
```

You can also install the CLI locally in a project:

```bash
npm install mastra
```

## Usage

Run commands from a Mastra project:

```bash
mastra dev
mastra build
mastra start
```

Use `mastra init` to add Mastra to an existing TypeScript project, or use `create-mastra` to scaffold a new application.

```bash
mastra init
npx create-mastra@latest
```

## Documentation

- [CLI commands reference](https://mastra.ai/reference/cli/mastra)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/cli/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
