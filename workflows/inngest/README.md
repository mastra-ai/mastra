# @mastra/inngest

`@mastra/inngest` connects Mastra workflows and agents to Inngest for durable execution, retries, and step memoization. Use `init()` to create Inngest-backed workflow primitives, or `createInngestAgent()` when an agent run must survive process restarts and transient failures.

## Installation

```bash
npm install @mastra/inngest
```

## Usage

```typescript
import { Inngest } from 'inngest';
import { init } from '@mastra/inngest';

const inngest = new Inngest({ id: 'my-app' });
const { createWorkflow, createStep } = init(inngest);
```

## Documentation

- [Deploy Mastra with Inngest](https://mastra.ai/integrations/deploy/inngest)
- [Reference: createInngestAgent()](https://mastra.ai/reference/agents/inngest-agent)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workflows/inngest/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
