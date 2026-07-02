---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/editor': patch
'@mastra/server': patch
---

Added workspace-level provider registry to MastraEditor. You can now register WorkspaceProvider factories that build complete Workspace instances as a single unit, instead of composing from separate filesystem and sandbox providers. Stored agents can reference a workspace provider via `{ type: 'provider', provider: 'my-cloud', config: { ... } }` and the editor will call the registered factory during agent hydration.

```ts
import { MastraEditor } from '@mastra/editor';
import { Workspace } from '@mastra/core/workspace';

const editor = new MastraEditor({
  workspaces: {
    'my-cloud': {
      id: 'my-cloud',
      name: 'My Cloud Workspace',
      createWorkspace: (config) => new Workspace({
        id: 'cloud-ws',
        name: 'Cloud WS',
        filesystem: new MyCloudFilesystem(config),
        sandbox: new MyCloudSandbox(config),
      }),
    },
  },
});

// Stored agent workspace reference using the provider:
// { type: 'provider', provider: 'my-cloud', config: { region: 'us-east-1' } }
```
