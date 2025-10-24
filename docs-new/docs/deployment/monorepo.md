---
title: Monorepo Deployment
description: Learn how to deploy Mastra applications that are part of a monorepo setup
---

# Monorepo Deployment

Deploying Mastra in a monorepo follows the same approach as deploying a standalone application. While some [Cloud](./cloud-providers/) or [Serverless Platform](./serverless-platforms/) providers may introduce extra requirements, the core setup is the same.

## Example monorepo

In this example, the Mastra application is located at `apps/api`.

> File structure information available - see original documentation for detailed tree view.

## Environment variables

Environment variables like `OPENAI_API_KEY` should be stored in an `.env` file at the root of the Mastra application `(apps/api)`, for example:

> File structure information available - see original documentation for detailed tree view.

## Deployment configuration

The image below shows how to select `apps/api` as the project root when deploying to [Mastra Cloud](../mastra-cloud/overview). While the interface may differ between providers, the configuration remains the same.

![Deployment configuration](/img/monorepo/monorepo-mastra-cloud.jpg)

## Dependency management

In a monorepo, keep dependencies consistent to avoid version conflicts and build errors.

- Use a **single lockfile** at the project root so all packages resolve the same versions.
- Align versions of **shared libraries** (like Mastra or frameworks) to prevent duplicates.

## Deployment pitfalls

Common issues to watch for when deploying Mastra in a monorepo:

- **Wrong project root**: make sure the correct package (e.g. `apps/api`) is selected as the deploy target.

## Bundler options

Use `transpilePackages` to compile TypeScript workspace packages or libraries. List package names exactly as they appear in each `package.json`. Use `externals` to exclude dependencies resolved at runtime, and `sourcemap` to emit readable stack traces.

```typescript filename="src/mastra/index.ts" showLineNumbers copy
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  // ...
  bundler: {
    transpilePackages: ['utils'],
    externals: ['ui'],
    sourcemap: true,
  },
});
```

> See [Mastra Class](/docs/reference/core/mastra-class) for more configuration options.

## Supported monorepos

Mastra works with:

- npm workspaces
- pnpm workspaces
- Yarn workspaces
- Turborepo

Known limitations:

- Bun workspaces — partial support; known issues
- Nx — You can use Nx's [supported dependency strategies](https://nx.dev/concepts/decisions/dependency-management) but you need to have `package.json` files inside your workspace packages

> If you are experiencing issues with monorepos see our: [Monorepos Support mega issue](https://github.com/mastra-ai/mastra/issues/6852).
