# Server App Access Example

Demonstrates how to use `mastra.getServerApp<T>()` to call routes directly without running an HTTP server.

## Usage

```typescript
import { Mastra } from '@mastra/core/mastra';
import { HonoBindings, HonoVariables, MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import type { Hono as HonoType } from 'hono';

// Create your Mastra instance with tools, workflows, etc.
const mastra = new Mastra({
  /* your config */
});

const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
const adapter = new MastraServer({ app, mastra });
await adapter.init();

// MastraServer auto-registers with mastra, so getServerApp() works
const serverApp = mastra.getServerApp<HonoType>();

// Call routes in-memory - no HTTP, no port binding
// The URL hostname is just a placeholder (only the path matters)
const response = await serverApp.fetch(
  new Request('http://internal/api/tools/my-tool/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { input: 'value' } }),
  }),
);
```

## Run the demo

```bash
pnpm install
pnpm demo
```
