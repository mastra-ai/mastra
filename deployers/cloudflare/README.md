# @mastra/deployer-cloudflare

The CloudflareDeployer bundles your Mastra server and generates a wrangler.jsonc file conforming to Cloudflare's wrangler configuration.

## Installation

```bash
npm install @mastra/deployer-cloudflare
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

## Documentation

- [Deploy to Cloudflare](https://mastra.ai/integrations/deploy/cloudflare)
- [CloudflareDeployer reference](https://mastra.ai/reference/deployer/cloudflare)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/cloudflare/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
