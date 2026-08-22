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

## Process memory diagnostics

Use `ProcessMemoryDiagnostics` to collect low-perturbation memory evidence from a long-running Node.js process. The service records process memory, V8 heap-space statistics, naturally occurring garbage collection (GC) events, and sampled allocation profiles. It doesn't force GC or write heap snapshots.

> **Warning:** Allocation profiles can contain prompts, credentials, file contents, and tool arguments. Store them in a restricted location, don't upload them as telemetry, and delete them when you finish the investigation.

The environment factory applies the supported defaults and validation rules:

```ts
import {
  createProcessMemoryDiagnosticsFromEnvironment,
  startConfiguredProcessMemoryDiagnostics,
} from '@mastra/code-sdk/process-memory-diagnostics';

const setup = createProcessMemoryDiagnosticsFromEnvironment(process.env);
const diagnostics = await startConfiguredProcessMemoryDiagnostics(setup, warning => {
  console.warn(warning);
});

try {
  // Create and run your Mastra Code process adapter.
} finally {
  await diagnostics.stop();
}
```

Construct and start diagnostics before creating Mastra Code. Stop work-producing services first during shutdown, then await `diagnostics.stop()` to write the final process sample and allocation profile.

### Configuration

| Environment variable                           | Default                           | Minimum | Description                                                 |
| ---------------------------------------------- | --------------------------------- | ------- | ----------------------------------------------------------- |
| `MASTRACODE_PROFILE`                           | Disabled                          | N/A     | Enables startup profiling for `1`, `true`, `yes`, or `on`   |
| `MASTRACODE_PROFILE_DIR`                       | `<Mastra Code app-data>/profiles` | N/A     | Parent directory for private, unique run directories        |
| `MASTRACODE_PROFILE_SAMPLE_INTERVAL_MS`        | `10000`                           | `1000`  | Process and V8 sample interval in milliseconds              |
| `MASTRACODE_PROFILE_CAPTURE_INTERVAL_MS`       | `300000`                          | `10000` | Durable allocation-profile capture interval in milliseconds |
| `MASTRACODE_PROFILE_ALLOCATION_INTERVAL_BYTES` | `524288`                          | `32768` | V8 allocation-sampling interval in bytes                    |

Truthy values are case-insensitive and may contain surrounding whitespace. Other values leave startup profiling disabled. Invalid numeric values produce an actionable error instead of starting a higher-overhead profiler.

### Artifacts

Each run directory contains:

- `metadata.json`: Immutable runtime and configuration metadata
- `process-samples.jsonl`: Append-only RSS, JavaScript heap, external memory, ArrayBuffer memory, resource usage, and V8 heap-space samples
- `gc-events.jsonl`: Append-only GC kind, flags, duration, and nearby memory values when V8 emits GC performance entries. A run can contain zero events.
- `allocation-<sequence>-<timestamp>.heapprofile`: Atomic Chrome allocation-sampling profiles. Each capture closes one sampling epoch and immediately starts the next.

The service requests mode `0700` for run directories and `0600` for files on POSIX systems. Other platforms may apply permissions differently.

Compare JavaScript heap growth with resident set size (RSS). Rising heap-space usage points to retained JavaScript objects. Rising RSS with a stable JavaScript heap can point to external buffers, ArrayBuffers, native libraries, memory-mapped files, or allocator behavior. Allocation profiles include objects collected by major and minor GC, which helps distinguish sustained retention from transient allocation pressure.

Sampling and periodic writes add overhead. Larger allocation intervals and longer capture intervals reduce it. A manual or periodic capture rotates allocation sampling without triggering a heap snapshot or forced GC.

Atomically completed captures survive later `SIGINT`, `SIGTERM`, `SIGHUP`, `SIGKILL`, or native crashes. Awaited shutdown can write a final capture for graceful signals and application errors. JavaScript can't guarantee a final capture after immediate `SIGKILL`, a native crash, or power loss, so use periodic captures for those cases.

Delete a run after analysis with your platform's file-removal tools. Never commit captured profiles.

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
