# Electron Chat with Mastra

A desktop chat application built with Electron and React, connected to a Mastra AI agent backend using AI SDK UI.

## Prerequisites

- Node.js v22.13.0 or later
- A running Mastra server on `http://localhost:4111` with a `chatRoute` configured

## Mastra server setup

If you don't already have a Mastra server, bootstrap one:

```bash
npx create-mastra@latest
```

Add a `chatRoute` in your `src/mastra/index.ts`:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { chatRoute } from '@mastra/ai-sdk';

export const mastra = new Mastra({
  // your agents, tools, etc.
  server: {
    apiRoutes: [
      chatRoute({
        path: '/chat/:agentId',
      }),
    ],
  },
});
```

Start the server:

```bash
npm run dev
```

## Running the Electron app

Install dependencies and start the app:

```bash
pnpm install
pnpm dev
```

The Electron window opens and connects to `http://localhost:4111/chat/weatherAgent`. You can change the agent ID in `src/renderer/src/App.tsx`.
