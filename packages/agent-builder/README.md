# @mastra/agent-builder

`@mastra/agent-builder` is a specialized agent that turns natural-language requirements into Mastra applications, agents, tools, and workflows. It is currently experimental and intended for Mastra's internal builder experience, so its APIs may change without notice.

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

## Documentation

- [@mastra/agent-builder documentation](https://mastra.ai/docs/studio/editor)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/agent-builder/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
