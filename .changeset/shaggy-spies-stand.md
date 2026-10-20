---
'@mastra/connect': minor
---

Added a callback form to tools() for per-request options. Pass a function that reads the request context and returns ToolsOptions to vary tool filters and approval policies per request (for example by user role), without losing the snapshot cache: resolutions producing the same options share one cached snapshot with the usual TTL semantics.

**Before** (per-request resolver, re-fetches every request):

```ts
tools: async ctx => {
  const role = ctx.requestContext?.get('role');
  return tools({
    providers: {
      linear: role === 'viewer' ? { allowTools: ['linear_list_*'] } : { requireApproval: ['linear_delete_*'] },
    },
  })(ctx);
};
```

**After** (one resolver, cache intact):

```ts
tools: tools(ctx => ({
  providers: {
    linear:
      ctx?.requestContext?.get('role') === 'viewer'
        ? { allowTools: ['linear_list_*'] }
        : { requireApproval: ['linear_delete_*'] },
  },
}));
```
