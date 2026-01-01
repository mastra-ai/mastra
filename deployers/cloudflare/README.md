# @mastra/deployer-cloudflare

A Cloudflare Workers deployer for Mastra applications.

## Features

- Deploy Mastra applications to Cloudflare Workers
- Configure custom domains and routes
- Automatic environment variable configuration
- Supports all Wrangler configuration options

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
  name: 'your-worker-name',
  account_id: 'your-account-id',
  routes: [
    {
      pattern: 'example.com/*',
      zone_name: 'example.com',
      custom_domain: true,
    },
  ],
  // Add any other Wrangler configuration options here
  // See: https://developers.cloudflare.com/workers/wrangler/configuration/
});

const mastra = new Mastra({
  deployer,
  // ... other Mastra configuration options
});
```

## Configuration

The `CloudflareDeployer` constructor accepts the same configuration options as `wrangler.json` (see [documentation](https://developers.cloudflare.com/workers/wrangler/configuration/)).

**Notes:**

- `main` property is fixed by the deployer
- Some properties have default values set by the deployer

## Environment Variables

The deployer will automatically load environment variables from:

- `.env` files in your project
- Environment variables passed through the Mastra configuration

## Requirements

- Cloudflare account with Workers enabled
- API token with appropriate permissions
- Domain(s) configured in Cloudflare (for custom domains)
