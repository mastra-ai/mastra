# The Mastra CLI

![Mastra Cli](https://github.com/mastra-ai/mastra/blob/main/packages/cli/mastra-cli.png)

The Mastra CLI lets you initialize a new project, spin up a local dev server, and deploy it to serverless platforms like Vercel and Cloudflare Workers.

## Installing the Mastra CLI

```bash copy
npm i -g mastra
```

## Commands

### Project Setup

```bash
# Initialize a new project
mastra init
```

## Deployment

Mastra's data syncing infrastructure is designed for Next.js sites running on serverless hosting providers like Vercel or Netlify.

Logs are stored in [Upstash](https://upstash.com/).

## Commands

### Init

`mastra init` is used for initializing a new project.

This creates a mastra directory under `src` containing an `index.ts` entrypoint and an `agent` directory containing two sample agents.

```text
project-root/
├── src/
   ├── app/
   └── mastra/
       ├── agents/
       │   └── agents.ts
       └── index.ts
```

### Engine

`mastra engine add`

This installs the `@mastra/engine` dependency to your project.

`mastra engine generate`

Generates the Drizzle database client and TypeScript types.

`mastra engine migrate`

This migrates the database forward. You might need to run this after updating mastra.

`mastra engine up`

This is a shortcut that runs the `docker-compose up` command using the `mastra-pg.docker-compose.yaml` file. This will spin up any local docker containers that mastra needs.

It is useful for cases where you don't have a dockerized `postgres` db setup.

### Dev

`mastra dev`

This spins up a local development server that hosts `REST` endpoints for all agents and workflows. It also has a chat interface for testing them.

The server is useful for testing and developing agents, workflows, and integrations without needing to deploy your application.

The server is available at `http://localhost:3000`.

### Build

`mastra build`

This command builds your Mastra project for deployment to different environments. The build process:

1. Reads your Mastra configuration
2. Generates optimized files for your target environment
3. Outputs them to a build directory

Options:

```bash
--dir     Directory containing Mastra files (default: src/mastra)
```

Example usage:

```bash
# Build using default directory
mastra build

# Build from custom directory
mastra build --dir path/to/mastra
```

The build output is determined by your Mastra instance's deployer configuration:

```typescript
const mastra = new Mastra({
  deployer: {
    type: 'HONO', // Target environment (HONO, EXPRESS, NEXT)
    // Environment-specific options
  },
});
```

### Deploy

`mastra deploy`

This command deploys the mastra project to a serverless platform like Vercel or Cloudflare Workers.

The deploy command does the following:

- Initializes the mastra project
- Builds the project
- Deploys the built project to the platform

# Telemetry

This CLI collects anonymous usage data (no personal/sensitive info) to help improve Mastra. This includes:

- Commands used
- Command execution time
- Error occurrences
- System information (OS, Node version)

To opt-out:

1. Add `NO_MASTRA_TELEMETRY=1` to commands

## Local development

1. clone the repo
2. Run `pnpm i` to install deps
