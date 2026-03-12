---
'@mastra/agentfs': minor
---

Added AgentFSFilesystem workspace provider — a Turso/SQLite-backed filesystem via the agentfs-sdk that gives agents persistent, database-backed file storage across sessions.

**Basic usage**

```ts
import { Workspace } from '@mastra/core/workspace';
import { AgentFSFilesystem } from '@mastra/agentfs';

const workspace = new Workspace({
  filesystem: new AgentFSFilesystem({
    agentId: 'my-agent',
  }),
});
```
