---
'@mastra/core': minor
---

Channel handlers can now contribute to the request context of the run they start.

`ChannelHandlerContext` gains a `requestContext` field holding the `RequestContext` for the run the inbound message is about to start. It is constructed fresh for every message, and a handler may write to it before calling `defaultHandler`. Core then adds its own channel and render-context entries and dispatches with the same instance, so anything the handler wrote reaches the run.

This is the seam for host-owned multi-tenancy: a host that maps a platform sender to one of its own tenants can stamp that tenant itself, rather than core needing to know how the host resolves identity.

```ts
import { AgentControllerChannels } from '@mastra/core/channels';

const channels = new AgentControllerChannels({
  adapters,
  handlers: {
    onDirectMessage: async (thread, message, defaultHandler, ctx) => {
      const link = await lookupLink(message.sender);
      if (!link) {
        await postConnectPrompt(thread);
        return; // not calling defaultHandler means no run starts
      }

      ctx.requestContext.set('user', { id: link.userId, organizationId: link.orgId });
      await defaultHandler(thread, message);
    },
  },
});
```

**Contract change:** `ChannelHandler`'s 4th `ctx` parameter is now non-optional (`ctx: ChannelHandlerContext`, previously `ctx?: ChannelHandlerContext`). Core has always passed it, and requiring it means a handler writing `ctx.requestContext.set(...)` needs neither a non-null assertion nor a guard that would silently skip the write.

Handler *implementations* are unaffected: TypeScript lets a function declaring fewer parameters satisfy a type declaring more, so existing three-parameter handlers — and anyone who wrote `ctx?.mastra` — keep compiling. Code that *calls* a `ChannelHandler`-typed value with three arguments does need updating, and will fail with `Expected 4 arguments, but got 3` until the context is passed.
