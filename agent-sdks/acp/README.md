# @mastra/acp

`@mastra/acp` connects Mastra to coding agents that implement the Agent Client Protocol (ACP). Use it to run an ACP-compatible agent from a Mastra tool or as a Mastra sub-agent.

## Installation

```bash
npm install @mastra/acp
```

## Overview

The package exports:

- `createACPTool`: Creates a Mastra tool that sends a task to an ACP agent and returns the completed output.
- `AcpAgent`: Wraps an ACP agent as a Mastra sub-agent with `generate()` and `stream()` support.

Use `createACPTool` when the ACP agent should be callable as a tool. Use `AcpAgent` when the ACP agent should participate in Mastra agent delegation.

## Create an ACP tool

The following example creates a tool that starts an ACP-compatible agent process and sends the provided task to it.

```typescript
import { Agent } from '@mastra/core/agent';
import { createACPTool } from '@mastra/acp';

const codeAgentTool = createACPTool({
  id: 'code-agent',
  description: 'Use an ACP-compatible coding agent to make code changes',
  command: 'acp-agent',
  args: ['--stdio'],
  cwd: process.cwd(),
});

export const agent = new Agent({
  name: 'supervisor',
  instructions: 'Use the code-agent tool when a task requires editing code.',
  model,
  tools: {
    codeAgentTool,
  },
});
```

The tool accepts a `task` string and returns an `output` string.

```typescript
const result = await codeAgentTool.execute({
  context: {
    task: 'Update the README with setup instructions.',
  },
});

console.log(result.output);
```

## Use an ACP agent as a sub-agent

`AcpAgent` implements Mastra's `SubAgent` interface. Add it to another agent's `agents` configuration to let the supervisor delegate work to the ACP agent.

```typescript
import { Agent } from '@mastra/core/agent';
import { AcpAgent } from '@mastra/acp';

const codeAgent = new AcpAgent({
  id: 'code-agent',
  name: 'Code agent',
  description: 'An ACP-compatible coding agent that can inspect and edit files',
  command: 'acp-agent',
  args: ['--stdio'],
  cwd: process.cwd(),
});

export const supervisor = new Agent({
  name: 'supervisor',
  instructions: 'Delegate code editing tasks to the code-agent sub-agent.',
  model,
  agents: {
    codeAgent,
  },
});
```

`AcpAgent.generate()` buffers the ACP response and returns it as text. `AcpAgent.stream()` emits Mastra `text-delta` chunks as ACP `agent_message_chunk` updates arrive.

## Configure permissions

ACP agents may request permission before running actions. By default, `@mastra/acp` selects the first permission option. Pass `onPermissionRequest` to handle permission requests yourself.

```typescript
import { createACPTool } from '@mastra/acp';

const codeAgentTool = createACPTool({
  id: 'code-agent',
  description: 'Use an ACP-compatible coding agent',
  command: 'acp-agent',
  args: ['--stdio'],
  async onPermissionRequest(request) {
    const option = request.options.find(option => option.name === 'Allow');

    if (!option) {
      return { outcome: { outcome: 'cancelled' } };
    }

    return {
      outcome: {
        outcome: 'selected',
        optionId: option.optionId,
      },
    };
  },
});
```

## Session and workspace behavior

`createACPTool` and `AcpAgent` start the configured command on first use and create an ACP session. Sessions persist across calls by default. Set `persistSession: false` to stop the ACP process after each prompt.

```typescript
const codeAgent = new AcpAgent({
  id: 'code-agent',
  description: 'Run one isolated ACP task',
  command: 'acp-agent',
  args: ['--stdio'],
  cwd: process.cwd(),
  persistSession: false,
});
```

By default, the ACP workspace uses `cwd` as its filesystem root. Pass a Mastra `Workspace` with a custom filesystem when you need explicit workspace control.

## Configuration

`createACPTool` and `AcpAgent` accept the same ACP connection options.

| Option                | Type                             | Description                                                                            |
| --------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| `id`                  | `string`                         | Unique tool or sub-agent identifier.                                                   |
| `description`         | `string`                         | Description shown to the model when it can call the tool or delegate to the sub-agent. |
| `command`             | `string`                         | ACP agent executable to spawn.                                                         |
| `args`                | `string[]`                       | Arguments passed to the ACP agent executable.                                          |
| `env`                 | `Record<string, string>`         | Environment variables to merge with the current process environment.                   |
| `cwd`                 | `string`                         | Working directory for the ACP process and default workspace.                           |
| `session`             | `Partial<NewSessionRequest>`     | ACP session creation options.                                                          |
| `initialize`          | `Partial<InitializeRequest>`     | ACP initialization options.                                                            |
| `authMethodId`        | `string`                         | ACP authentication method ID to invoke after initialization.                           |
| `persistSession`      | `boolean`                        | Keep the ACP process alive after execution. Defaults to `true`.                        |
| `onPermissionRequest` | `(request) => Promise<Response>` | Callback for ACP permission requests.                                                  |
| `workspace`           | `Workspace`                      | Workspace used for ACP file reads and writes.                                          |
| `model`               | `string`                         | Model ID to select after session creation via the ACP `session/set_model` method.      |

`AcpAgent` also accepts `name` to set the display name used by Mastra agent delegation.

## Configure the model

ACP agents may expose selectable models. Instead of setting an environment variable like `ANTHROPIC_MODEL`, you can pass a `model` ID directly in the configuration.

### Discover available models

Call `getAvailableModels()` to see which models the ACP agent supports. This starts the agent process and returns the model list from the session:

```typescript
import { AcpAgent } from '@mastra/acp';

const codeAgent = new AcpAgent({
  id: 'code-agent',
  description: 'An ACP-compatible coding agent',
  command: 'claude',
  args: ['--acp'],
});

const models = await codeAgent.getAvailableModels();
// [{ modelId: 'claude-sonnet-4-20250514', name: 'Claude Sonnet' }, ...]
```

### Set the model

Pass the `model` option to select a model at connection time:

```typescript
import { AcpAgent } from '@mastra/acp';

const codeAgent = new AcpAgent({
  id: 'code-agent',
  description: 'An ACP-compatible coding agent',
  command: 'claude',
  args: ['--acp'],
  model: 'claude-sonnet-4-20250514',
});
```

You can also change the model at runtime with `setModel()`:

```typescript
await codeAgent.setModel('claude-sonnet-4-20250514');
```

If the ACP agent advertises available models and your model ID doesn't match any of them, Mastra throws an error listing the valid options:

```text
Model "bad-model-id" is not available. Available models: claude-sonnet-4-20250514, claude-haiku-4-20250514
```

If the agent doesn't advertise a model list, the value is passed through without validation.
