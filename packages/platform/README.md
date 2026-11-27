# @mastra/platform (experimental)

Hosted Mastra Platform clients for managed agents, Memory, Knowledge, and Browser, with Sandbox and Filesystem re-exported from the `@mastra/platform-workspace` dependency.

## Installation

```sh
npm install @mastra/platform
```

## Usage

Set `MASTRA_PLATFORM_ACCESS_TOKEN` (or `MASTRA_PLATFORM_SECRET_KEY`). `PlatformMemory` also needs `MASTRA_MEMORY_INSTANCE_ID` and `PlatformKnowledge` needs `MASTRA_KNOWLEDGE_INSTANCE_ID`; the example below uses both, so set both IDs. Obtain your instance IDs and credentials from Mastra Platform.

```ts
import { Agent } from '@mastra/core/agent';
import { PlatformMemory, PlatformKnowledge } from '@mastra/platform';

const model = 'openai/gpt-4o-mini';
const agent = new Agent({
  name: 'assistant',
  model,
  memory: new PlatformMemory(),
});
const knowledge = new PlatformKnowledge();
```

`PlatformSandbox` and `PlatformFilesystem` are also available from `@mastra/platform`.

### Managed agents

`MastraPlatform` creates and runs agents hosted on Mastra Platform. Use a project access token: it names its project, so `projectId` is only needed for other tokens (or set `MASTRA_PROJECT_ID`).

To work in other projects with the same credentials, `platform.getProject(projectId)` returns a `MastraProject`: everything below (`listAgents()`, `createAgent()`, `getMemory()`, ...) without passing the project ID again. `new MastraProject({ accessToken, projectId })` works on its own too.

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
for await (const text of response.textStream) process.stdout.write(text);

const { messages } = await agent.listMessages('thread-1', { resourceId: 'user-1' });
```

A managed agent is a Mastra `Agent` that runs on the Platform: `stream` and `generate` return the same output a local agent does, and you can register it in `new Mastra({ agents })`, hand it to another agent as a sub-agent, or run it as a workflow step. Every run acts for an end user, whose memory, threads, and connected accounts it uses. Pass `memory.resource` or `resourceId`; in a workflow step or a server route, the request context's end user is used. Use `await platform.getAgent(id)` for an existing agent; agents also have `details`, `update`, `delete`, and `listThreads`.

### Memory, knowledge, connected accounts, and sandboxes

The same client reaches the project's other services with the same token.

```ts
// Memory and Knowledge instances (IDs fall back to MASTRA_MEMORY_INSTANCE_ID / MASTRA_KNOWLEDGE_INSTANCE_ID)
const memory = platform.getMemory({ instanceId: 'mem_123' });
const { threads } = await memory.client.listThreads({ resourceId: 'user-1' });
const knowledge = platform.getKnowledge({ instanceId: 'kn_123' });

// Connect an end user's GitHub account: send them to connectUrl to sign in
const user = platform.connect.withResource('user-1');
const { connectionId } = await user.createConnectSession('github');
const { connectUrl } = await user.getConnectUrl(connectionId);
const connections = await user.listConnections();

// Start a sandbox and run a command in it
const sandbox = await platform.createSandbox({ environmentId: 'env_123' });
const { stdout } = await sandbox.executeCommand('ls', ['-la']);

// Later, reconnect to it by ID (fails if it no longer exists)
const again = await platform.getSandbox(sandbox.sandboxId!);
const sandboxes = await platform.sandboxes.list('env_123');

// A provisioned file system, for a Workspace
const workspace = new Workspace({ filesystem: await platform.getFilesystem('bucket_123') });

// A provisioned database as Mastra storage
const mastra = new Mastra({ storage: await platform.getStorage('db_123') });
```

Each of these is the framework type it stands in for: `getMemory` returns a `MastraMemory`, `getKnowledge` a `Knowledge`, `getFilesystem` a `MastraFilesystem`, `createSandbox` and `getSandbox` a `MastraSandbox`, and `getStorage` a `MastraStorage`. `connect` is the `ConnectClient` from `@mastra/connect`; an end user's connections are visible to, and removable by, only that end user. `getStorage` loads the store for the database's kind, so install it alongside: `@mastra/libsql` for Turso, `@mastra/pg` for Neon and Postgres, `@mastra/redis` for Redis. `getSandbox` reconnects through the provider that runs the sandbox; `createSandbox` with a `sandboxId` reattaches if it can and otherwise starts a new one.

### Provisioning projects

Signed in as an organization member (for example with a token from `mastra auth tokens create`), the same client creates projects and provisions what runs in them. Provisioning runs in the background: `create` returns the resource while it is still `provisioning`, and `waitUntilReady` polls until it is ready, throwing `MastraPlatformError` if provisioning fails.

```ts
const platform = new MastraPlatform({ accessToken: process.env.MASTRA_API_TOKEN, organizationId: 'org_123' });

const created = await platform.projects.create({ name: 'Support Desk' });
const project = platform.getProject(created.id);
await project.setupAgents();

const [production] = await project.environments.list();
const memory = await project.memoryInstances.create({ name: 'support-memory' });
await project.memoryInstances.waitUntilReady(memory.id);

const database = await project.databases.create({ kind: 'turso', name: 'app-db' });
await project.databases.waitUntilReady(database.id);
const { envVars } = await project.databases.connection(database.id);

const files = await project.filesystems.create({ environmentId: production.id, name: 'uploads' });
```

Creating Memory instances, Knowledge instances, and databases requires the `admin` role.

### Datasets and experiments

`project.datasets` has the same methods as `mastra.datasets`, and the datasets it returns have the same methods as `Dataset` from `@mastra/core/datasets`. Reads and writes go to the project's datasets, which Studio shows. Code written against `mastra.datasets` works when given `{ datasets: project.datasets }`.

`startExperiment` runs the experiment in your process and uploads each result, with its scores, as the item finishes. Pass `mastra` to run an agent or workflow registered on it; with `task`, no Mastra is needed. Nothing is written to that Mastra's own storage.

```ts
const project = new MastraProject({ accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN });

const dataset = await project.datasets.create({ name: 'Billing questions' });
await dataset.addItems({ items: [{ input: 'Where is my invoice?', groundTruth: 'Billing > Invoices' }] });

const summary = await dataset.startExperiment({
  mastra,
  targetType: 'agent',
  targetId: 'support',
  scorers: [answerMatches],
});
```

To run items yourself, create an experiment, submit each result, and finalize it:

```ts
const { experimentId } = await dataset.createExperiment({ name: 'baseline', provenance: { source: 'ci' } });
await dataset.submitExperimentResult({
  experimentId,
  itemId,
  output,
  scores: [{ scorerId: 'accuracy', score: 1 }],
  completedAt: new Date(),
});
await dataset.finalizeExperiment({ experimentId });
```

The project needs managed agents set up (`project.setupAgents()`), since its datasets live in their database, and observability on to store scores. The token needs `datasets:write` and `experiments:write`. Some core options aren't available and throw a `MastraError` instead of being ignored:

- The Platform assigns dataset IDs, so `create` takes no `id`.
- Experiments created from code have no target. `startExperiment` records the target you ran in the experiment's `metadata.target`.
- `startExperimentAsync`, `runExperimentItem`, and `compareExperiments` aren't supported, and neither are the tenancy options (`organizationId`, `projectId`).

### Hosted browser

Create a hosted browser from your Mastra Platform project's browser page, then pass its CDP URL to `PlatformBrowser`. Treat the CDP URL as a secret: anyone holding it can connect to that browser. Keep it server-side, do not commit it, and use a secure environment variable such as `MASTRA_BROWSER_CDP_URL`.

```ts
import { Agent } from '@mastra/core/agent';
import { PlatformBrowser } from '@mastra/platform';

const agent = new Agent({
  name: 'browser-agent',
  model: 'openai/gpt-4o-mini',
  browser: new PlatformBrowser({ cdpUrl: process.env.MASTRA_BROWSER_CDP_URL! }),
});
```

Alternatively, provide a Mastra Platform project ID and access token to provision a new Browserbase-backed session on demand. Browserbase credentials stay on the Platform server.

```ts
const browser = new PlatformBrowser({ projectId: 'your-project-id' });
```

`PlatformBrowser` uses `MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` and `MASTRA_PROJECT_ID` when the corresponding options are omitted for on-demand provisioning. It POSTs `{ projectId }` to `https://platform.mastra.ai/v1/browsers/sessions` (overridable with `apiUrl` or `MASTRA_BROWSER_API_URL`) and connects to the returned CDP URL with shared browser scope. A project access token must be authorized for that project. Supplying `cdpUrl` skips provisioning and does not require a Platform token or project ID.

### Knowledge transport contract

- `POST {apiUrl}/v1/knowledge/{instanceId}/operations/{operation}` with `Authorization: Bearer {accessToken}` and JSON body `{ input }`; returns `{ result }`.
- `instanceId` and `apiUrl` come from options or `MASTRA_KNOWLEDGE_INSTANCE_ID` and `MASTRA_KNOWLEDGE_API_URL`; `apiUrl` defaults to `https://knowledge-api.mastra.ai`. The service derives the authorized project from the instance and credential; `projectId` is accepted for compatibility but is not sent.
- `renameScopeDeclaration` is not forwarded and rejects with `KnowledgeUnsupportedCapabilityError`: its `check` callback cannot be sent to the hosted store.
- Credential priority: option `accessToken`, `MASTRA_KNOWLEDGE_ACCESS_TOKEN` (a Knowledge-only token, used when set and non-empty), `MASTRA_PLATFORM_ACCESS_TOKEN`, `MASTRA_PLATFORM_SECRET_KEY`.
- The server checks that the instance belongs to the credential's organization and, for project-bound tokens, its project; it allowlists page-store operations and never accepts a connection string from the caller.
- Hosted Knowledge requires a core and PostgreSQL adapter release implementing the Knowledge pages-v4 contract; production release alignment remains pending.

## Documentation

`PlatformKnowledge` extends core `Knowledge` and delegates schema-v4 page-store operations to the hosted service. The provider, connection string, importer, and sync scheduler belong to Platform rather than this client. For general API concepts, see [Mastra documentation](https://mastra.ai/docs).

### Verification matrix

The same scenarios must run once with core `Knowledge` on local PostgreSQL and again with `PlatformKnowledge` against Compose-backed Platform: scope materialization and discovery; nested page create/update/move/delete; search and read; notes and links; pin visibility; editor/viewer access; agent tool attachment, including denial across scopes. Connect-backed source provisioning, import, and incremental re-sync require a separate linked-source scenario; host page writes alone do not prove this integration.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/platform/CHANGELOG.md).

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
