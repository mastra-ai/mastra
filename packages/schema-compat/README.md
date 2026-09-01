# @mastra/schema-compat

Schema compatibility layer for Mastra.ai that provides compatibility fixes for different AI model providers when using Zod schemas with tools.

## Installation

```bash
npm install @mastra/schema-compat
```

## Usage

### Basic Usage

The package provides a base `SchemaCompatLayer` class that you can extend to create custom compatibility layers for different AI model providers:

```typescript
import { SchemaCompatLayer } from '@mastra/schema-compat';
import type { LanguageModelV1 } from 'ai';

class MyCustomCompat extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  shouldApply(): boolean {
    return this.getModel().provider === 'my-provider';
  }

  getSchemaTarget() {
    return 'jsonSchema7';
  }

  processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    // Your custom processing logic here
    return value;
  }
}
```

## Documentation

- [@mastra/schema-compat documentation](https://mastra.ai/docs/agents/structured-output)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/schema-compat/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
