---
'@mastra/slack': minor
'@mastra/core': minor
---

Added `waitUntil` support for channels so background agent runs survive serverless responses.

Without `waitUntil`, the runtime freezes the invocation as soon as the webhook response returns, killing the agent run mid-flight and leaving the user with no reply.

**Auto-detected (no config needed):**

- **Cloudflare Workers** — reads `c.executionCtx.waitUntil`
- **Netlify Functions** — reads `c.env.context.waitUntil`

**Requires explicit config:**

Vercel and AWS Lambda need a `waitUntil` function passed directly, because Vercel exposes it via AsyncLocalStorage (not request context) and Lambda has none natively:

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

For runtimes where `waitUntil` lives on the request context but isn't covered by the default, pass `resolveWaitUntil: (c) => fn | undefined` instead.

Resolution order: `waitUntil` → `resolveWaitUntil(c)` → core default.
