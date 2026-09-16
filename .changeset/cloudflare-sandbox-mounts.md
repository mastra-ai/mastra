---
'@mastra/cloudflare-sandbox': minor
---

Added bucket mounts to `CloudflareSandbox` so files can survive container sleep. Cloudflare stops an idle container after `sleepAfter`, and the next command starts fresh, so `/workspace` was silently lost between agent turns. The sandbox now implements the Workspace `mounts` hook: any `S3Filesystem` (including Cloudflare R2) listed under `mounts` is mounted through the bridge on `start()`, and the Cloudflare Sandbox re-establishes it when a slept container wakes.

```typescript
const workspace = new Workspace({
  sandbox: new CloudflareSandbox({ baseUrl, apiToken }),
  mounts: {
    '/workspace/data': new S3Filesystem({
      bucket: 'agent-data',
      region: 'auto',
      endpoint,
      accessKeyId,
      secretAccessKey,
    }),
  },
});
```

The default instructions now tell the model that `/workspace` is scratch space that does not survive between commands and list the mounted paths to use instead. Fixes #23706.
