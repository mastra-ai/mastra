# @mastra/agent-builder

`@mastra/agent-builder` is a specialized agent that turns natural-language requirements into Mastra applications, agents, tools, and workflows. This experimental package requires a Mastra Enterprise license for production use, and its APIs may change without notice.

## Installation

```bash
npm install @mastra/agent-builder
```

## Usage

Set a supported model and the path to a Mastra project.

```typescript
import { AgentBuilder } from '@mastra/agent-builder';

const builder = new AgentBuilder({
  model: 'openai/gpt-5.6-sol',
  summaryModel: 'openai/gpt-5.6-sol',
  projectPath: process.cwd(),
});

const result = await builder.generate('Create a weather agent with a typed forecast tool.');
console.log(result.text);
```

### Workflows

`agentBuilderWorkflows`, `agentBuilderTemplateWorkflow`, `workflowBuilderWorkflow` and `planningAndApprovalWorkflow` are shared objects, created once when the package loads. A workflow uses the storage, logger and agents of the last Mastra instance that registered it, and keeps its unfinished runs in memory. Share them only in a process with a single Mastra instance.

When one process runs several Mastra instances, such as one per tenant or per test, give each instance its own set with `createAgentBuilderWorkflows()`:

```typescript
import { createAgentBuilderWorkflows } from '@mastra/agent-builder';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({ workflows: createAgentBuilderWorkflows() });
```

`createAgentBuilderTemplateWorkflow()`, `createWorkflowBuilderWorkflow()` and `createPlanningAndApprovalWorkflow()` build a single new workflow. The agent-builder routes in `@mastra/server` already create one set per instance.

## Documentation

`AgentBuilder` extends Mastra's `Agent` with defaults intended for code generation. It can inspect an existing project, summarize available tools, write generated files to disk, and keep long builder sessions within the model's token limits.

The constructor accepts the primary `model`, an optional `summaryModel`, and the target `projectPath`. It configures memory and builder-oriented processors internally, then applies deterministic generation defaults for multi-step code changes.

This package is intended for the Mastra Agent Builder product rather than as a stable general-purpose public API. Production use of the Agent Builder experience is subject to the [Mastra Enterprise License](https://github.com/mastra-ai/mastra/blob/main/ee/LICENSE).

- [Agent Builder documentation](https://agent-builder.mastra.ai/)
- [`AgentBuilderOptions` reference](https://agent-builder.mastra.ai/reference/agent-builder-options)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/agent-builder/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
