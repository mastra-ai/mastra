---
'@mastra/vercel': patch
---

`VercelSandbox` now forwards three Vercel Sandbox options: `region`, `failoverRegions`, and `mounts`.

```ts
import { Drive } from '@vercel/sandbox';
import { VercelSandbox } from '@mastra/vercel';

const drive = await Drive.getOrCreate({ name: 'agent-data' });

const sandbox = new VercelSandbox({
  // A Drive and the sandbox that mounts it must share a region.
  region: drive.region,
  failoverRegions: ['fra1', 'sfo1'],
  mounts: { '/data': drive },
});
```

`region` pins sandbox creation to a Vercel region, and `failoverRegions` lists the regions Vercel can fall back to, in order. `mounts` attaches a Vercel Drive to a path inside the sandbox; each value is a `Drive` instance, a `drive.snapshot()` read-only copy, or an explicit `{ drive: string, mode }` pair where `drive` is the Drive's name.

All three options are passed to `Sandbox.create()` and `Sandbox.getOrCreate()`, so a sandbox created for a name uses them. When a sandbox with that name already exists, `getOrCreate` resumes it unchanged: the supplied `region`, `failoverRegions`, and `mounts` don't reconfigure it. Before, the adapter ignored them: every sandbox ran in the SDK default region and no Drives could be attached.
