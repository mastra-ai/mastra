---
'@mastra/vercel': patch
---

`VercelSandbox` now forwards three Vercel Sandbox options: `region`, `failoverRegions`, and `mounts`.

```ts
import { Drive } from '@vercel/sandbox';
import { VercelSandbox } from '@mastra/vercel';

const drive = await Drive.getOrCreate({ name: 'agent-data' });

const sandbox = new VercelSandbox({
  region: 'fra1',
  failoverRegions: ['iad1', 'sfo1'],
  mounts: { '/data': drive },
});
```

`region` pins sandbox creation to a Vercel region, and `failoverRegions` lists the regions Vercel can fall back to, in order. `mounts` attaches a Vercel Drive to a path inside the sandbox; each value is a `Drive`, a `drive.snapshot()` read-only copy, or `{ drive, mode }`.

All three options are passed to `Sandbox.create()` and `Sandbox.getOrCreate()`, so a sandbox reconnected by a later process uses the same region, failover list, and mounts. Before, the adapter ignored them: every sandbox ran in the SDK default region and no Drives could be attached.
