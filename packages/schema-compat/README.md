# @mastra/schema-compat

Schema conversion and provider-compatibility utilities used across Mastra. It adapts Zod, Standard Schema, and JSON Schema inputs for model providers.

## Installation

```bash
npm install @mastra/schema-compat
```

## Usage

Convert a supported schema to the Standard Schema interface.

```typescript
import { toStandardSchema } from '@mastra/schema-compat';
import { z } from 'zod';

const schema = toStandardSchema(z.object({ answer: z.string() }));
```

## Documentation

- [@mastra/schema-compat documentation](https://mastra.ai/docs/agents/structured-output)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/schema-compat/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
