# @mastra/s3vectors

Amazon S3 Vectors store provider for Mastra. Use `@mastra/s3vectors` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/s3vectors
```

## Usage

Configure the database credentials required by your provider.

```typescript
import { S3Vectors } from '@mastra/s3vectors';

const vectorStore = new S3Vectors({
  vectorBucketName: process.env.S3VECTORS_BUCKET!,
  clientConfig: { region: process.env.AWS_REGION! },
});
```

## Documentation

- [@mastra/s3vectors documentation](https://mastra.ai/reference/vectors/s3vectors)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/s3vectors/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
