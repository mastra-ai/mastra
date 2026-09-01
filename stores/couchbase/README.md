# @mastra/couchbase

A Mastra vector store implementation for Couchbase, enabling powerful vector similarity search capabilities using the official Couchbase Node.js SDK (v4+). Leverages Couchbase Server's built-in Vector Search feature (available in version 7.6.4+).

## Installation

```bash
npm install @mastra/couchbase
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { CouchbaseVector } from '@mastra/couchbase';

const vectorStore = new CouchbaseVector({
  connectionString: process.env.COUCHBASE_CONNECTION_STRING!,
  username: process.env.COUCHBASE_USERNAME!,
  password: process.env.COUCHBASE_PASSWORD!,
  bucketName: 'vectors',
  scopeName: '_default',
  collectionName: 'documents',
});
```

## Documentation

- [@mastra/couchbase documentation](https://mastra.ai/reference/vectors/couchbase)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/couchbase/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
