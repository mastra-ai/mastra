# @mastra/dsql

Amazon Aurora DSQL storage provider for Mastra. Use `@mastra/dsql` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/dsql
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { DSQLStore } from '@mastra/dsql';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const store = new DSQLStore({
  id: 'my-dsql-store',
  host: 'abc123.dsql.us-east-1.on.aws',
  customCredentialsProvider: fromNodeProviderChain(),
});
```

## Documentation

- [@mastra/dsql documentation](https://mastra.ai/reference/storage/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/dsql/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
