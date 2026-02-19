---
'@mastra/deployer-netlify': minor
---

Added `target` option to `NetlifyDeployer` for deploying as Netlify Edge Functions.

```typescript
export const mastra = new Mastra({
  deployer: new NetlifyDeployer({
    target: 'edge',
  }),
});
```

Edge functions run on Deno at the network edge, closer to users, with no hard execution timeout (only a CPU time limit). This makes them a better fit for longer-running AI workflows that may exceed the 10s serverless function timeout.

The default target remains `'serverless'`, so existing usage is unaffected.
