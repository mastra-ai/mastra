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

A managed agent is a Mastra `Agent`: register it in `new Mastra({ agents })`, give it to another agent as a sub-agent, or run it as a workflow step. Agents can also be read, listed, updated, and deleted. Each run acts for an end user: pass `memory.resource` or `resourceId`.

A managed agent also reports what it runs with on the Platform. `listTools()` returns its tools; calling one runs it on the Platform for the end user. `getModel()` returns its model, which runs locally through the Mastra Gateway when `MASTRA_GATEWAY_API_KEY` is set. `getMemory()` returns the Platform Memory its conversations are saved in. When a managed agent runs as a sub-agent, its conversation is saved once, not again by the supervisor.

```ts
const memory = platform.getMemory({ instanceId: 'mem_123' });
const knowledge = platform.getKnowledge({ instanceId: 'kn_123' });

const { connectionId } = await platform.connect.withResource('user-1').createConnectSession('github');

const sandbox = await platform.createSandbox({ environmentId: 'env_123' });
const { stdout } = await sandbox.executeCommand('ls', ['-la']);

const filesystem = await platform.getFilesystem('bucket_123');
const storage = await platform.getStorage('db_123');
```

Each is the framework type it stands in for (`MastraMemory`, `Knowledge`, `MastraSandbox`, `MastraFilesystem`, `MastraStorage`), and `connect` is `@mastra/connect`'s `ConnectClient`. `getStorage` needs the store for the database's kind installed: `@mastra/libsql`, `@mastra/pg`, or `@mastra/redis`.

The same client provisions projects for an organization member: create projects and environments, and Memory instances, Knowledge instances, databases, and file systems in them.

```ts
const platform = new MastraPlatform({ accessToken: process.env.MASTRA_API_TOKEN, organizationId: 'org_123' });
const { id } = await platform.projects.create({ name: 'Support Desk' });
const project = platform.getProject(id);
await project.setupAgents();

const memory = await project.memoryInstances.create({ name: 'support-memory' });
await project.memoryInstances.waitUntilReady(memory.id);
```
