# @mastra/inngest

Mastra Inngest integration. Use `@mastra/inngest` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/inngest
```

## Usage

Configure the prerequisites described in the documentation.

```typescript
import { Inngest } from 'inngest';
import { init } from '@mastra/inngest';

const inngest = new Inngest({ id: 'my-app' });
const { createWorkflow, createStep } = init(inngest);
```

## Documentation

- [@mastra/inngest documentation](https://mastra.ai/docs/workflows/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workflows/inngest/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
