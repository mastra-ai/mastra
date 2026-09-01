# @mastra/elasticsearch

ElasticSearch vector store provider for Mastra. Use `@mastra/elasticsearch` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/elasticsearch
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { Client } from '@elastic/elasticsearch';
import { ElasticSearchVector } from '@mastra/elasticsearch';

const client = new Client({ node: 'http://localhost:9200' });
const vectorDB = new ElasticSearchVector({ id: 'my-vector-store', client });
```

## Documentation

- [@mastra/elasticsearch documentation](https://mastra.ai/reference/vectors/elasticsearch)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/elasticsearch/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
