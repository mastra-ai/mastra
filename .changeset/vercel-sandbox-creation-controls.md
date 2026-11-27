---
'@mastra/vercel': patch
---

`VercelSandbox` now exposes the creation-time controls the `@vercel/sandbox` SDK already supported. Pass `image` to start from a Vercel Container Registry image, `source: { type: 'snapshot', snapshotId }` to restore a filesystem snapshot, and `networkPolicy` to allow, deny or filter outbound traffic, protecting a newly created sandbox from its first command. Creation options apply only when a new sandbox is created, so an existing sandbox resumed by `sandboxName` keeps the configuration and network policy it was created with.

`runtime` now only defaults to `'node24'` when the sandbox starts from a runtime. It is mutually exclusive with `image` and `source`, and the constructor throws a descriptive error if more than one environment is set. `clone()` inherits the selected image or snapshot source and the network policy along with the rest of the configuration.

```ts
const offline = new VercelSandbox({ runtime: 'node24', networkPolicy: 'deny-all' });

const fromImage = new VercelSandbox({
  image: 'my-repo:v1',
  networkPolicy: { allow: ['registry.npmjs.org'] },
});
```
