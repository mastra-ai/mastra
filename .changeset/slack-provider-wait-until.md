---
'@mastra/slack': minor
'@mastra/core': minor
---

Forward a runtime-provided `waitUntil` from `SlackProvider` to AgentChannels and the
Chat SDK so background agent runs survive serverless responses. Without `waitUntil`
the runtime freezes the invocation as soon as the 200 ack returns, killing the agent
run mid-flight and leaving Slack with no reply.

**`@mastra/core/channels`** now exports a small helper and resolver type:

```ts
import { resolveWaitUntil, type WaitUntilResolver } from '@mastra/core/channels';
```

`resolveWaitUntil(c)` reads `c.executionCtx.waitUntil` (populated by Hono's
Cloudflare Workers adapter) — guarded against Hono's getter that throws in Node.js
when no ExecutionContext exists.

**`SlackProvider`** accepts an optional `resolveWaitUntil` resolver for runtimes
Hono doesn't bridge automatically (Vercel, Netlify, custom platforms). The resolver
receives the request's Hono `Context` and returns the platform's `waitUntil`.

```ts
import { waitUntil } from '@vercel/functions';

new SlackProvider({
  resolveWaitUntil: () => waitUntil,
});
```

Cloudflare Workers users don't need to pass anything — the default helper reads
`c.executionCtx.waitUntil` automatically.
