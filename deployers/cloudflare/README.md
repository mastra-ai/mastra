# @mastra/deployer-cloudflare

A Cloudflare Workers deployer for Mastra applications.

## Features

- Deploy Mastra applications to Cloudflare Workers
- Automatic environment variable configuration

## Installation

```bash
pnpm add @mastra/deployer-cloudflare
```

## Usage

The Cloudflare deployer is used as part of the Mastra framework:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

const deployer = new CloudflareDeployer({
  name: 'your-project-name',
  routes: [
    {
      pattern: 'example.com/*',
      zone_name: 'example.com',
      custom_domain: true,
    },
  ],
  assets: {
    directory: './assets/',
  },
});

const mastra = new Mastra({
  deployer,
  // ... other Mastra configuration options
});
```

## Configuration

The `CloudflareDeployer` constructor accepts the same configuration options as `wrangler.json`. See the [Wrangler configuration documentation](https://developers.cloudflare.com/workers/wrangler/configuration/) for all available options.

**Deprecated fields:** If migrating from an earlier version, note that `projectName`, `d1Databases`, `kvNamespaces`, and `workerNamespace` are deprecated. Use the standard `wrangler.json` property names instead (`name`, `d1_databases`, `kv_namespaces`).

## Environment Variables

The deployer will automatically load environment variables from:

- `.env` files in your project
- Environment variables passed through the Mastra configuration

## Requirements

- Cloudflare account with Workers enabled
- API token with appropriate permissions
- Domain(s) configured in Cloudflare (for custom domains)
