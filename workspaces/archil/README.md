# @mastra/archil

Store Mastra workspace files on Archil elastic serverless disks with S3-compatible operations, POSIX shell access, snapshots, and persistent volumes.

## Installation

```bash
npm install @mastra/archil
```

## Usage

```typescript
import { ArchilFilesystem } from '@mastra/archil';

const filesystem = new ArchilFilesystem({
  diskId: 'dsk-0123456789abcdef',
  apiKey: process.env.ARCHIL_API_KEY!,
  region: 'aws-us-east-1',
});
```

## Documentation

- [Archil](https://mastra.ai/integrations/file-storage/archil)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/archil/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
