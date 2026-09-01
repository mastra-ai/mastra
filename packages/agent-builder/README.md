# @mastra/agent-builder

Experimental agent-building utilities for generating and editing Mastra projects. The APIs are intended for internal Mastra tooling and may change.

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
```

## Documentation

- [@mastra/agent-builder documentation](https://mastra.ai/docs/studio/editor)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/agent-builder/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
