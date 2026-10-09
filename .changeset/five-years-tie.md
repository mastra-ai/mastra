---
'@mastra/smol': minor
---

Add a Smol microVM workspace sandbox for local and cloud agent workloads. Use a local mount to let Mastra file tools and VM commands share a project directory:

```ts
import { Workspace, LocalFilesystem } from '@mastra/core/workspace'
import { SmolSandbox } from '@mastra/smol'

const source = '/path/to/project'
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: source }),
  sandbox: new SmolSandbox({
    id: 'project-agent',
    mounts: [{ source, target: '/workspace' }],
  }),
})
```

Set `target: 'cloud'` to run without local virtualization. Sandboxes without host mounts pause and resume with memory intact, and `snapshot()` saves a durable checkpoint when configured.
