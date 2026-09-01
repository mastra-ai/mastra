# @mastra/deployer-vercel

The VercelDeployer bundles your Mastra server and generates output conforming to Vercel's Build Output API.

## Installation

```bash
npm install @mastra/deployer-vercel
```

## Usage

The Vercel deployer is used as part of the Mastra framework:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { VercelDeployer } from '@mastra/deployer-vercel';

const deployer = new VercelDeployer({
  // Optional per-function overrides (written to .vc-config.json)
  maxDuration: 600,
  memory: 1536,
  regions: ['sfo1', 'iad1'],
});

const mastra = new Mastra({
  deployer,
  // ... other Mastra configuration options
});
```

## Documentation

- [Deploy to Vercel](https://mastra.ai/integrations/deploy/vercel)
- [VercelDeployer reference](https://mastra.ai/reference/deployer/vercel)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/vercel/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
