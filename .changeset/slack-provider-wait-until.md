---
'@mastra/slack': minor
'@mastra/core': minor
---

Forward a runtime-provided `waitUntil` from channels to the Chat SDK so background
agent runs survive serverless responses. Without `waitUntil` the runtime freezes the
invocation as soon as the 200 ack returns, killing the agent run mid-flight and
leaving the user with no reply.

**Defaults (no config needed):** `@mastra/core/channels` ships a default resolver
that reads `waitUntil` from the request context for the common cases:

- **Cloudflare Workers** — `c.executionCtx.waitUntil` (populated by Hono's CF adapter).
- **Netlify Functions** — `c.env.context.waitUntil` (forwarded by `hono/netlify`).

**Vercel and AWS Lambda** need an explicit `waitUntil` because Vercel exposes
`waitUntil` via AsyncLocalStorage (not the request context) and AWS Lambda has none
natively. Pass it via the new `waitUntil` option on `SlackProvider` or `ChannelConfig`:

```ts
import { waitUntil } from '@vercel/functions';
import { SlackProvider } from '@mastra/slack';

new SlackProvider({ waitUntil });
```

```ts
new Agent({
  channels: {
    adapters: { slack: createSlackAdapter({ ... }) },
    waitUntil,
  },
});
```

For runtimes where `waitUntil` lives on the request context but isn't covered by the
default helper, pass `resolveWaitUntil: (c) => fn | undefined` instead.

Resolution order: bare `waitUntil` → `resolveWaitUntil(c)` → core default.
