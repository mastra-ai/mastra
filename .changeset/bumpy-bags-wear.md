---
'@mastra/core': minor
---

Channel handlers can now contribute to the request context of the run they start.

`ChannelHandlerContext` gains a `requestContext` field holding the `RequestContext` for the run the inbound message is about to start. It is constructed fresh for every message, and a handler may write to it before calling `defaultHandler`. Core then adds its own channel and render-context entries and dispatches with the same instance, so anything the handler wrote reaches the run.

```ts
import { AgentControllerChannels } from '@mastra/core/channels';

const channels = new AgentControllerChannels({
  adapters,
  handlers: {
    onDirectMessage: async (thread, message, defaultHandler, ctx) => {
      ctx.requestContext.set('locale', 'en-GB');
      await defaultHandler(thread, message);
    },
  },
});
```

Anything a run reads from its request context can now be decided per inbound message — for example resolving which user a platform sender maps to, so the run uses that user's stored credentials.

**Contract change:** `ChannelHandler`'s 4th `ctx` parameter is now non-optional (`ctx: ChannelHandlerContext`, previously `ctx?: ChannelHandlerContext`). Core has always passed it, and requiring it means a handler writing `ctx.requestContext.set(...)` needs neither a non-null assertion nor a guard that would silently skip the write.

Handler *implementations* are unaffected: TypeScript lets a function declaring fewer parameters satisfy a type declaring more, so existing three-parameter handlers — and anyone who wrote `ctx?.mastra` — keep compiling. Code that *calls* a `ChannelHandler`-typed value with three arguments does need updating, and will fail with `Expected 4 arguments, but got 3` until the context is passed.
