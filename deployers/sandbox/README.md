# @mastra/deployer-sandbox

Deploy a Mastra server into any workspace sandbox that supports networking and get a live public URL. Install `@mastra/deployer-sandbox` to use it in your Mastra application.

## Installation

```bash
npm install @mastra/deployer-sandbox
```

## Usage

Provide a supported sandbox implementation.

```typescript
import { SandboxDeployer } from '@mastra/deployer-sandbox';

export function createDeployer(sandbox: ConstructorParameters<typeof SandboxDeployer>[0]['sandbox']) {
  return new SandboxDeployer({ sandbox });
}
```

## Documentation

- [@mastra/deployer-sandbox documentation](https://mastra.ai/docs/deployment/sandbox)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/deployers/sandbox/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
