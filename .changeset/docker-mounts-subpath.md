---
'@mastra/docker': minor
---

Added a `mounts` option to `DockerSandbox` for mount configurations that the `volumes` option cannot express. Each entry maps directly to Docker's native mount API, so you can now mount a subdirectory of a named volume, set per-mount read-only, labels, bind propagation, and tmpfs sizing.

The most common use case is mounting a read-only parent alongside a writable subdirectory of the same named volume — for example, giving each conversation its own writable folder inside a shared persistent volume. `volumes` and `mounts` can be used together.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { DockerSandbox } from '@mastra/docker';

const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    mounts: [
      { type: 'volume', source: 'project-data', target: '/shared', readOnly: true },
      {
        type: 'volume',
        source: 'project-data',
        target: '/work',
        volumeOptions: { subpath: 'conversations/abc123' },
      },
    ],
  }),
});
```

Subpath mounting requires Docker Engine 26.0 or newer.
