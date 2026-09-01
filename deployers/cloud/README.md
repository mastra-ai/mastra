# @mastra/deployer-cloud

A cloud-optimized deployer for Mastra applications with built-in telemetry, logging, and storage integration.

## Installation

```bash
npm install @mastra/deployer-cloud
```

## Usage

The cloud deployer is used as part of the Mastra build process:

```typescript
import { CloudDeployer } from '@mastra/deployer-cloud';

const deployer = new CloudDeployer();
const mastraDir = './src/mastra';
const outputDirectory = './.mastra/output';

await deployer.bundle(mastraDir, outputDirectory);

// The deployer automatically:
// - Adds cloud dependencies
// - Sets up instrumentation
// - Configures logging and storage
```

## Documentation

- [@mastra/deployer-cloud documentation](https://mastra.ai/docs/deployment/cloud-providers)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/cloud/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
