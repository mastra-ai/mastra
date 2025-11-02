# @mastra/server-express

`@mastra/server-express` provides an Express adapter for hosting Mastra-powered applications. It wraps the existing Hono-based Mastra server implementation and exposes it as Express middleware, making it straightforward to integrate Mastra within an existing Express stack.

## Installation

```bash
pnpm add @mastra/server-express express
```

You also need `@mastra/core` and any agents, workflows, or storage drivers your application depends on.

## Usage

```ts
import express from 'express';
import { Mastra } from '@mastra/core/mastra';
import { createExpressApp, startExpressServer } from '@mastra/server-express';
import { tools } from './tools';

const mastra = new Mastra({
  // ...your Mastra configuration
});

async function bootstrap() {
  const app = await createExpressApp(mastra, {
    tools,
    playground: process.env.NODE_ENV !== 'production',
  });

  await startExpressServer(mastra, app);
}

bootstrap().catch(err => {
  console.error('Failed to start server', err);
  process.exit(1);
});
```

### Options

| Option | Description |
| --- | --- |
| `tools` | A record of pre-instantiated Mastra tools available to the server. |
| `playground` | Enables the Mastra Playground UI when `true`. |
| `isDev` | Enables development-only endpoints and middleware. |
| `mountPath` | Optional path prefix when mounting the adapter within an existing Express app. |

You may pass an existing Express instance via the `app` option when you want to attach the Mastra routes to an app that already has middleware configured.

### Starting the server manually

If you only need the middleware, call `createExpressApp` and mount the returned router on your own server. To start an HTTP(S) server automatically, use `startExpressServer`, which reads port and TLS configuration from the Mastra instance (via `mastra.getServer()`).

## Helper utilities

This package re-exports `getToolExports` from `@mastra/deployer/server` so you can reuse existing tool discovery logic.

```ts
import { getToolExports } from '@mastra/server-express';
import * as toolModules from './mastra-tools';

const tools = getToolExports(Object.values(toolModules));
```

## License

Apache-2.0
