---
'@mastra/server': minor
'@mastra/mcp-apps-components': minor
'@mastra/core': minor
---

The model can now change what an open observability explorer shows in MCP Apps clients, instead of opening a new view for every follow-up. Ask "now show me the error logs" or "open that trace" and the explorer already on screen switches tab, filters, or trace within a few seconds. When you change filters or open a trace in the explorer yourself, the model can read that back too.

The view's state is kept in Mastra's server cache, so it works across instances that share one. It's on under `mastra dev` and when a cache other than the in-memory default is configured. Turn it on or off with `server.mcp.appSteering`:

```ts
import { RedisServerCache } from '@mastra/redis';
import Redis from 'ioredis';

export const mastra = new Mastra({
  cache: new RedisServerCache({ client: new Redis(process.env.REDIS_URL!) }),
  server: { mcp: { appSteering: true } },
});
```
