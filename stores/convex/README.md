# @mastra/convex

`@mastra/convex` provides Convex-backed storage, vector search, and server caching for Mastra applications. It includes development-scale and native vector implementations, along with server-side Convex definitions and handlers.

## Installation

```bash
npm install @mastra/convex
```

## Usage

Create a vector store with your Convex deployment URL and an admin auth token. Use `ConvexNativeVector` for production-scale native vector search, or `ConvexVector` for development-scale search implemented by the package.

```typescript
import { ConvexNativeVector } from '@mastra/convex';

const vectorStore = new ConvexNativeVector({
  id: 'convex-vectors',
  deploymentUrl: process.env.CONVEX_URL!,
  adminAuthToken: process.env.CONVEX_ADMIN_KEY!,
});

await vectorStore.createIndex({ indexName: 'documents', dimension: 1536 });
```

## Documentation

- [Convex integration guide](https://mastra.ai/integrations/databases/convex)
- [Convex vector reference](https://mastra.ai/reference/vectors/convex)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/convex/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
