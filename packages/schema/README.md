# @mastra/schema

Schema compatibility layer for Mastra.ai that provides compatibility fixes for different AI model providers when using Zod schemas with tools.

## Installation

```bash
pnpm add @mastra/schema
```

## Usage

### Basic Usage

The package provides a base `SchemaCompatibility` class that you can extend to create custom compatibility layers for different AI model providers:

```typescript
import { SchemaCompatibility } from '@mastra/schema';
import type { LanguageModelV1 } from 'ai';

class MyCustomCompat extends SchemaCompatibility {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  shouldApply(): boolean {
    return this.getModel().provider === 'my-provider';
  }

  getSchemaTarget() {
    return 'jsonSchema7';
  }

  processZodType(value) {
    // Your custom processing logic here
    return value;
  }
}
```

### Schema Processing

The package includes pre-built compatibility layers for popular AI providers:

Use the `processSchema` function to automatically apply the right compatibility layer:

```typescript
import { processSchema, OpenAISchemaCompat, AnthropicSchemaCompat } from '@mastra/schema';
import { yourCustomCompatibilityLayer } from "./customComatibilityLayer"
import { z } from 'zod';

const schema = z.object({
  name: z.string().email(),
  preferences: z.array(z.string()).min(1)
});

const compatibilities = [
  new OpenAISchemaCompat(model),
  new AnthropicSchemaCompat(model)
  new yourCustomCompatibilityLayer(model)
];

// Automatically applies the first matching compatibility
const result = processSchema({
  schema,
  compatibilities,
  mode: 'aiSdkSchema' // or 'jsonSchema'
});
```

### Schema Building Utilities

The package also provides utility functions for schema conversion:

```typescript
import { convertZodSchemaToAISDKSchema, convertSchemaToZod } from '@mastra/schema';
import { z } from 'zod';
import { jsonSchema } from 'ai';

const zodSchema = z.object({
  name: z.string(),
  age: z.number(),
});

// Convert Zod to AI SDK Schema
const aiSchema = convertZodSchemaToAISDKSchema(zodSchema);

// Convert AI SDK Schema back to Zod
const aiSdkSchema = jsonSchema({
  type: 'object',
  properties: {
    title: { type: 'string' },
  },
});
const backToZod = convertSchemaToZod(aiSdkSchema);
```

## API Reference

### Classes

- `SchemaCompatibility` - Base abstract class for creating compatibility layers
- `AnthropicSchemaCompat` - Compatibility for Anthropic Claude models
- `OpenAISchemaCompat` - Compatibility for OpenAI models (without structured outputs)
- `OpenAIReasoningSchemaCompat` - Compatibility for OpenAI reasoning models (o1 series)
- `GoogleSchemaCompat` - Compatibility for Google Gemini models
- `DeepSeekSchemaCompat` - Compatibility for DeepSeek models
- `MetaSchemaCompat` - Compatibility for Meta Llama models

### Functions

- `processSchema(options)` - Process schema with automatic compatibility detection
- `convertZodSchemaToAISDKSchema(zodSchema, target?)` - Convert Zod schema to AI SDK Schema
- `convertSchemaToZod(schema)` - Convert AI SDK Schema to Zod schema

### Types and Constants

- `StringCheckType`, `NumberCheckType`, `ArrayCheckType` - Check types for validation
- `UnsupportedZodType`, `SupportedZodType`, `AllZodType` - Zod type classifications
- `ZodShape`, `ShapeKey`, `ShapeValue` - Utility types for Zod schemas
- `ALL_STRING_CHECKS`, `ALL_NUMBER_CHECKS`, `ALL_ARRAY_CHECKS` - Validation constraint arrays
- `SUPPORTED_ZOD_TYPES`, `UNSUPPORTED_ZOD_TYPES` - Type classification arrays

## Provider-Specific Behavior

Different AI providers have varying levels of support for JSON Schema features. This package handles these differences automatically:

- **OpenAI**: Removes certain string validations for models without structured outputs
- **Anthropic**: Handles complex nested schemas with proper constraint descriptions
- **Google**: Uses OpenAPI 3.0 schema format for better compatibility
- **DeepSeek**: Converts advanced string patterns to descriptions
- **Meta**: Optimizes array and union type handling

## Testing

The package includes comprehensive tests covering all functionality:

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test --watch
```

## License

Elastic-2.0
