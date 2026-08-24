---
'@mastra/ai-sdk': minor
---

Added `withSseHeartbeat()` to the public API so you can keep server-sent event streams alive outside of `chatRoute()`.

If you build the response yourself in a Next.js, Astro, Nuxt, or SvelteKit route handler, proxies can drop the connection when the stream sends no bytes during a long reasoning burst or slow tool call. `chatRoute()` already avoided this with its `heartbeatMs` option, but the underlying helper was not exported.

**Before**

```ts
return createUIMessageStreamResponse({ stream });
```

**After**

```ts
import { withSseHeartbeat } from '@mastra/ai-sdk';

return withSseHeartbeat(createUIMessageStreamResponse({ stream }), 15000);
```

`assertValidHeartbeatMs()` is exported alongside it so you can validate a user-supplied interval before streaming. Closes #21954.
