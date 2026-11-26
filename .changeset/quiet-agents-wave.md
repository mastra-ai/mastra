---
'@mastra/platform': minor
---

Added `MastraPlatform`, a client for a Mastra Platform project: create and run managed agents, and reach the project's memory, knowledge, connected accounts, and sandboxes with one project access token.

```ts
import { MastraPlatform } from '@mastra/platform';

const platform = new MastraPlatform({ accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN });

const agent = await platform.createAgent({
  name: 'Support',
  instructions: 'Answer billing questions.',
  model: 'openai/gpt-5-mini',
});

const response = await agent.stream('Where is my invoice?', {
  memory: { thread: 'thread-1', resource: 'user-1' },
});

const { messages } = await agent.listMessages('thread-1', { resourceId: 'user-1' });
```

Agents can also be read, listed, updated, and deleted. Each run acts for an end user: pass `memory.resource` or `resourceId`.

```ts
const memory = platform.getMemory({ instanceId: 'mem_123' });
const knowledge = platform.getKnowledge({ instanceId: 'kn_123' });

const { connectUrl } = await platform.connect.createConnectSession('github', { resourceId: 'user-1' });

const sandbox = await platform.createSandbox({ environmentId: 'env_123' });
const { stdout } = await sandbox.executeCommand('ls', ['-la']);
```

The same client provisions projects for an organization member: create projects and environments, and Memory instances, Knowledge instances, databases, and file systems in them.

```ts
const platform = new MastraPlatform({ accessToken: process.env.MASTRA_API_TOKEN, organizationId: 'org_123' });
const { id } = await platform.projects.create({ name: 'Support Desk' });
const project = platform.project(id);
await project.setupAgents();

const memory = await project.memoryInstances.create({ name: 'support-memory' });
await project.memoryInstances.waitUntilReady(memory.id);
```
