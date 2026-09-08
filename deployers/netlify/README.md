# @mastra/deployer-netlify

The NetlifyDeployer class handles packaging, configuration, and deployment by adapting Mastra's output to create an optimized version of your server.

## Installation

```bash
npm install @mastra/deployer-netlify
```

## Usage

The Netlify deployer is used as part of the Mastra framework:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { NetlifyDeployer } from '@mastra/deployer-netlify';

const mastra = new Mastra({
  deployer: new NetlifyDeployer(),
});
```

## Documentation

- [Deploy to Netlify](https://mastra.ai/integrations/deploy/netlify)
- [NetlifyDeployer reference](https://mastra.ai/reference/deployer/netlify)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/netlify/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
