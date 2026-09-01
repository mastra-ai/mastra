# @mastra/factory

Mastra Software Factory module: the server core behind the Mastra Software Factory — storage domains, integrations, and surfaces for agent-powered software delivery. Use `@mastra/factory` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/factory
```

## Usage

Provide a configured `FactoryStorage` backend.

```typescript
import { MastraFactory } from '@mastra/factory';
import type { MastraFactoryConfig } from '@mastra/factory';

export function createFactory(storage: MastraFactoryConfig['storage']) {
  return new MastraFactory({ storage });
}
```

## Documentation

- [Use Mastra Factory with an E2B sandbox](https://mastra.ai/integrations/sandboxes/e2b)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/mastracode/factory/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
