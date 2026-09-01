# @mastra/deployer

Utilities for using @mastra/deployer with Mastra. Install `@mastra/deployer` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/deployer
```

## Usage

Implement the base deployer contract when creating a custom deployment target.

```typescript
import type { Deployer } from '@mastra/deployer';

export function useDeployer(deployer: Deployer) {
  return deployer;
}
```

## Documentation

- [@mastra/deployer documentation](https://mastra.ai/reference/deployer)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/deployer/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
