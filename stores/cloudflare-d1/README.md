# @mastra/cloudflare-d1

A Mastra store for Cloudflare D1 SQL databases, supporting threads, messages, workflows, evaluations, and traces with robust SQL features.

## Installation

```bash
npm install @mastra/cloudflare-d1
```

## Usage

### With Workers D1 Binding

```typescript
import { D1Store } from '@mastra/cloudflare-d1';

const store = new D1Store({
  binding: env.DB, // D1Database binding from Worker environment
  tablePrefix: 'mastra_', // optional
});
```

## Documentation

- [Cloudflare D1 integration guide](https://mastra.ai/integrations/databases/cloudflare-d1)
- [Storage reference](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/cloudflare-d1/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
