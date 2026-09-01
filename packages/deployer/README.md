# @mastra/deployer

Core deployment infrastructure for Mastra applications, handling build, packaging, and deployment processes.

## Installation

```bash
npm install @mastra/deployer
```

## Usage

```typescript
import { Deployer } from '@mastra/deployer';

// Create a deployer instance
const deployer = new Deployer({
  dir: '/path/to/project',
  type: 'Deploy', // or 'Dev' for development mode
});

// Install dependencies
await deployer.install();

// Write package.json
await deployer.writePackageJson();

// Get Mastra instance
const { mastra } = await deployer.getMastra();
```

## Documentation

- [@mastra/deployer documentation](https://mastra.ai/reference/deployer)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/deployer/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
