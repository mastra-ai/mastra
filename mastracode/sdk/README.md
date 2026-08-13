# @mastra/code-sdk

The agent core behind [Mastra Code](https://mastra.ai) — everything except the terminal UI. Use it to build your own UIs and surfaces (web apps, editors, bots) on top of the Mastra Code coding agent.

The published [`mastracode`](https://www.npmjs.com/package/mastracode) CLI/TUI and the Mastra Code web surface are both built on this SDK.

## Installation

```bash
npm install @mastra/code-sdk
```

## Usage

Mount the Mastra Code agent controller on a Mastra instance:

```ts
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';

// Creates a Mastra instance that hosts the Mastra Code agent controller
// (thread management, modes, tools, memory) and starts its workers.
const { mastra, controller } = await mountAgentControllerOnMastra({
  cwd: process.cwd(),
});
```

To construct the `Mastra` instance yourself (e.g. in a deployable `mastra` entry file), use `prepareAgentControllerMount`:

```ts
import { Mastra } from '@mastra/core/mastra';
import { prepareAgentControllerMount } from '@mastra/code-sdk';

const prepared = await prepareAgentControllerMount({ cwd: process.cwd() });

export const mastra = new Mastra(prepared.mastraArgs);

await prepared.finalize();
```

### Add input processors

Embedding surfaces can prepend stateless input processors without replacing Mastra Code's required policy and compatibility processors:

```ts
const phaseProcessor = {
  id: 'current-phase',
  async processInputStep({ messages }) {
    await reconcileCompletedTools(messages);
  },
};

const prepared = await prepareAgentControllerMount({
  cwd: process.cwd(),
  inputProcessors: [phaseProcessor],
});
```

Configured processors run before Mastra Code's built-in input processors. Keep processor instances stateless because the mounted agent shares them across sessions and runs.

## Dynamic workflows

The local controller registers the Workflow Builder before workers start. In build mode, users can ask the code agent to create a workflow in natural language. The builder discovers registered agents, tools, and workflows, validates a complete definition, then persists and registers it immediately.

Use the workflow service to manage saved workflows from a custom SDK surface:

```ts
import { deleteWorkflow, getWorkflow, listWorkflows, runWorkflow } from '@mastra/code-sdk/workflows/service';

const { workflows } = await listWorkflows(mastra);
const firstWorkflow = workflows[0];
if (!firstWorkflow) throw new Error('No Dynamic Workflows are available.');

const definition = await getWorkflow(mastra, firstWorkflow.id);
if (!definition) throw new Error(`Workflow "${firstWorkflow.id}" was not found.`);

const result = await runWorkflow(mastra, definition.id, { topic: 'dynamic workflows' });
await deleteWorkflow(mastra, definition.id);
```

Pass the session request context to `runWorkflow` when workflow agent steps need the session-selected model. You can also pass an event callback as the fifth argument to render workflow step progress.

Multi-user hosts can scope Dynamic Workflow authoring and management to a trusted identity already installed in Mastra's `RequestContext`:

```ts
import { mountAgentControllerOnMastra } from '@mastra/code-sdk';
import type { RequestContext } from '@mastra/core/request-context';
import type { DynamicWorkflowAccessPolicy } from '@mastra/code-sdk/workflows/access-policy';
import { createWorkflowService } from '@mastra/code-sdk/workflows/service';

const workflowAccessPolicy: DynamicWorkflowAccessPolicy = {
  resolveAuthorId: ({ requestContext }) => requestContext.get('verified-user-id') as string | undefined,
};

const { mastra } = await mountAgentControllerOnMastra({
  cwd: process.cwd(),
  workflowAccessPolicy,
});

const workflows = createWorkflowService({ accessPolicy: workflowAccessPolicy });
async function listForRequest(requestContext: RequestContext) {
  return workflows.listWorkflows(mastra, { requestContext });
}
```

The host is responsible for authenticating the request and setting the trusted context value. When a policy is configured but does not resolve an author, Dynamic Workflow discovery and mutations fail closed. Code-defined workflows remain available. The same policy is used by the code agent's workflow tools and the Workflow Builder, so callers cannot select an author through tool input.

Deep modules are available as subpath imports, e.g.:

```ts
import { loadSettings } from '@mastra/code-sdk/onboarding/settings';
```

> The subpath API surface is still evolving and may change between minor releases while the package is pre-1.0.

## License

Apache-2.0
