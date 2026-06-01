# @mastra/files-sdk

Unified storage filesystem provider for Mastra workspaces, powered by [FilesSDK](https://files-sdk.dev). Works with any FilesSDK adapter — S3, Cloudflare R2, Google Cloud Storage, Azure Blob, Vercel Blob, local filesystem, and more.

## Installation

```bash
npm install @mastra/files-sdk files-sdk
```

Then install the FilesSDK adapter for your storage backend:

```bash
# AWS S3 / R2 / MinIO / DigitalOcean Spaces
npm install @aws-sdk/client-s3 @aws-sdk/s3-presigned-post @aws-sdk/s3-request-presigner

# Google Cloud Storage
npm install @google-cloud/storage google-auth-library

# Azure Blob Storage
npm install @azure/storage-blob @azure/core-auth @azure/identity

# Vercel Blob
npm install @vercel/blob

# Local filesystem (dev/test)
# No extra dependencies needed
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { FilesSDKFilesystem } from '@mastra/files-sdk';
import { Files } from 'files-sdk';
import { s3 } from 'files-sdk/s3';

const files = new Files({
  adapter: s3({
    bucket: 'my-bucket',
    region: 'us-east-1',
  }),
});

const workspace = new Workspace({
  filesystem: new FilesSDKFilesystem({ files }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-5',
  workspace,
});
```

### Switching adapters

The power of FilesSDK is that you can swap storage backends by changing only the adapter import:

```typescript
import { Files } from 'files-sdk';
import { r2 } from 'files-sdk/r2';

const files = new Files({
  adapter: r2({
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucket: 'my-bucket',
  }),
});

const workspace = new Workspace({
  filesystem: new FilesSDKFilesystem({ files }),
});
```

### Local filesystem for development

```typescript
import { Files } from 'files-sdk';
import { fs } from 'files-sdk/fs';

const files = new Files({
  adapter: fs({ root: './.uploads' }),
});

const workspace = new Workspace({
  filesystem: new FilesSDKFilesystem({ files }),
});
```

## Options

| Option        | Type      | Required | Description                           |
| ------------- | --------- | -------- | ------------------------------------- |
| `files`       | `Files`   | Yes      | Pre-configured FilesSDK instance      |
| `id`          | `string`  | No       | Unique filesystem ID (auto-generated) |
| `displayName` | `string`  | No       | Human-friendly name for UI            |
| `icon`        | `string`  | No       | Icon identifier                       |
| `description` | `string`  | No       | Description for UI                    |
| `readOnly`    | `boolean` | No       | Mount as read-only                    |

## License

Apache-2.0
