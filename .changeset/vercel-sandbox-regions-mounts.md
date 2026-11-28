---
'@mastra/vercel': patch
---

`VercelSandbox` now forwards three Vercel Sandbox options: `region`, `failoverRegions`, and `mounts`.

```ts
import { Drive } from '@vercel/sandbox';
import { VercelSandbox } from '@mastra/vercel';

// Pin creation to a region and list the regions Vercel can fall back to.
// A failover region must not repeat `region`.
const sandbox = new VercelSandbox({
  region: 'fra1',
  failoverRegions: ['iad1', 'sfo1'],
});

// Mount a Drive. A sandbox's main region must match the Drive's region,
// so pass the Drive's region here.
const drive = await Drive.getOrCreate({ name: 'agent-data' });
const mounted = new VercelSandbox({
  region: drive.region,
  mounts: { '/data': drive },
});
```

`region` pins sandbox creation to a Vercel region, and `failoverRegions` lists the regions Vercel can fall back to, in order. `mounts` attaches a Vercel Drive to a path inside the sandbox; each value is a `Drive` instance, a `drive.snapshot()` read-only copy, or an explicit `{ drive: string, mode }` pair where `drive` is the Drive's name. A sandbox's main region must match each mounted Drive's region, and only one sandbox at a time can mount a Drive read-write.

All three options are passed to `Sandbox.create()` and `Sandbox.getOrCreate()`, so a sandbox created for a name uses them. When a sandbox with that name already exists, `getOrCreate` resumes it unchanged: the supplied `region`, `failoverRegions`, and `mounts` don't reconfigure it. Before, the adapter ignored them: every sandbox ran in the SDK default region and no Drives could be attached.
