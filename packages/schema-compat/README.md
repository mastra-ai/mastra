# @mastra/schema-compat

Schema compatibility layer for Mastra.ai that provides compatibility fixes for different AI model providers when using schemas with tools.

## Features

- **Standard JSON Schema Support**: Works with any library implementing [Standard JSON Schema V1](https://standardschema.dev/json-schema) for JSON Schema generation
- **Standard Schema Validation**: Supports [Standard Schema V1](https://standardschema.dev/) for runtime validation (Zod, Valibot, ArkType, etc.)
- **JSON Schema First-Class**: Use plain JSON Schema directly without needing a validation library
- **Provider Compatibility**: Automatic schema transformations for different AI providers
- **Bidirectional Conversion**: Convert between Zod, JSON Schema, and AI SDK Schema formats

## Installation

```bash
pnpm add @mastra/schema-compat
```

## Usage

### Standard Schema Support

Mastra supports validation libraries that implement the [Standard Schema](https://standardschema.dev/) specification. For AI tools, libraries should implement **BOTH** interfaces:

1. **[Standard JSON Schema V1](https://standardschema.dev/json-schema)** - For JSON Schema generation (LLMs need this to understand tool parameters)
2. **[Standard Schema V1](https://standardschema.dev/)** - For runtime validation

#### Recommended: Use AI SDK's `asSchema`

The easiest way to use any Standard Schema library with Mastra is via AI SDK's `asSchema` function:

```typescript
import { asSchema } from '@ai-sdk/provider-utils';
import { type } from 'arktype';

// ArkType implements both StandardSchemaV1 and StandardJSONSchemaV1
const userSchema = type({
  name: 'string',
  email: 'string',
  age: 'number?',
});

// Convert to AI SDK Schema - works seamlessly!
const aiSchema = asSchema(userSchema);

// Use with Mastra tools
const tool = createTool({
  id: 'get-user',
  inputSchema: userSchema, // Pass directly - Mastra handles conversion
  execute: async ({ context }) => {
    // context is fully typed!
    return { user: context.name };
  },
});
```

### Library Examples

#### Zod (Full Support)

Zod v3.25+ implements both Standard Schema interfaces:

```typescript
import { z } from 'zod';
import { asSchema } from '@ai-sdk/provider-utils';

const weatherSchema = z.object({
  location: z.string().describe('City name or coordinates'),
  units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  days: z.number().int().min(1).max(14).describe('Forecast days'),
});

const aiSchema = asSchema(weatherSchema);
// ✅ JSON Schema generated automatically
// ✅ Validation works with transforms and refinements
```

#### ArkType (Full Support)

ArkType implements both interfaces with excellent TypeScript inference:

```typescript
import { type } from 'arktype';
import { asSchema } from '@ai-sdk/provider-utils';

const querySchema = type({
  table: "'users' | 'orders' | 'products'",
  select: 'string[]',
  where: {
    field: 'string',
    operator: "'=' | '!=' | '>' | '<'",
    value: 'string | number',
  },
  limit: 'number?',
});

const aiSchema = asSchema(querySchema);
// ✅ JSON Schema generated via ~standard.jsonSchema.input()
// ✅ Validation via ~standard.validate()
```

#### Valibot (Validation Only)

Valibot v1.x implements `StandardSchemaV1` for validation but **not** `StandardJSONSchemaV1` for JSON Schema generation:

```typescript
import * as v from 'valibot';
import { isStandardSchema, isStandardJSONSchema } from '@mastra/schema-compat';

const searchSchema = v.object({
  query: v.pipe(v.string(), v.minLength(1)),
  maxResults: v.optional(v.pipe(v.number(), v.integer())),
});

console.log(isStandardSchema(searchSchema));     // ✅ true - can validate
console.log(isStandardJSONSchema(searchSchema)); // ❌ false - no JSON Schema generation

// Use Valibot's validation directly via Standard Schema interface:
const result = await searchSchema['~standard'].validate({ query: 'test' });
if ('value' in result) {
  console.log('Valid:', result.value);
} else {
  console.log('Errors:', result.issues);
}
```

> **Note**: For Valibot to work with AI SDK's `asSchema`, you'd need a library that generates JSON Schema from Valibot schemas (like `@valibot/to-json-schema` when available).

#### Checking Library Capabilities

```typescript
import { isStandardSchema, isStandardJSONSchema } from '@mastra/schema-compat';

// Check if a schema can validate
if (isStandardSchema(schema)) {
  const result = await schema['~standard'].validate(data);
}

// Check if a schema can generate JSON Schema (preferred for AI tools)
if (isStandardJSONSchema(schema)) {
  const jsonSchema = schema['~standard'].jsonSchema.input({ target: 'draft-07' });
}
```

#### Standard JSON Schema Target Formats

When using `StandardJSONSchemaV1`, you can specify the target JSON Schema version:

```typescript
import { convertStandardSchemaToAISDKSchema } from '@mastra/schema-compat';

// Use draft-07 (default, widely supported)
const aiSchema1 = convertStandardSchemaToAISDKSchema(schema, 'draft-07');

// Use draft-2020-12 (latest standard)
const aiSchema2 = convertStandardSchemaToAISDKSchema(schema, 'draft-2020-12');

// Use OpenAPI 3.0 format
const aiSchema3 = convertStandardSchemaToAISDKSchema(schema, 'openapi-3.0');
```

### JSON Schema Support

You can also use plain JSON Schema directly:

```typescript
import { convertAnySchemaToAISDKSchema, jsonSchema } from '@mastra/schema-compat';

const myJsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name'],
};

// Convert to AI SDK Schema with validation
const aiSchema = convertAnySchemaToAISDKSchema(myJsonSchema);
```

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

### Schema Processing

The package includes pre-built compatibility layers for popular AI providers:

Use the `applyCompatLayer` function to automatically apply the right compatibility layer:

```typescript
import { applyCompatLayer, OpenAISchemaCompatLayer, AnthropicSchemaCompatLayer } from '@mastra/schema-compat';
import { yourCustomCompatibilityLayer } from './customCompatibilityLayer';
import { z } from 'zod';

const schema = z.object({
  name: z.string().email(),
  preferences: z.array(z.string()).min(1),
});

const compatLayers = [
  new OpenAISchemaCompatLayer(model),
  new AnthropicSchemaCompatLayer(model),
  new yourCustomCompatibilityLayer(model),
];

// Automatically applies the first matching compatibility
const result = applyCompatLayer({
  schema,
  compatLayers,
  mode: 'aiSdkSchema', // or 'jsonSchema'
});
```

### Schema Building Utilities

The package also provides utility functions for schema conversion:

```typescript
import { convertZodSchemaToAISDKSchema, convertSchemaToZod } from '@mastra/schema-compat';
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
    name: { type: 'string' },
  },
});
const backToZod = convertSchemaToZod(aiSdkSchema);
```

## API Reference

### Classes

- `SchemaCompatLayer` - Base abstract class for creating compatibility layers
- `AnthropicSchemaCompatLayer` - Compatibility for Anthropic Claude models
- `OpenAISchemaCompatLayer` - Compatibility for OpenAI models (without structured outputs)
- `OpenAIReasoningSchemaCompatLayer` - Compatibility for OpenAI reasoning models (o1 series)
- `GoogleSchemaCompatLayer` - Compatibility for Google Gemini models
- `DeepSeekSchemaCompatLayer` - Compatibility for DeepSeek models
- `MetaSchemaCompatLayer` - Compatibility for Meta Llama models

### Functions

- `applyCompatLayer(options)` - Process schema with automatic compatibility detection
- `convertZodSchemaToAISDKSchema(zodSchema, target?)` - Convert Zod schema to AI SDK Schema
- `convertStandardSchemaToAISDKSchema(schema, target?)` - Convert Standard Schema to AI SDK Schema
- `convertAnySchemaToAISDKSchema(schema, target?)` - Convert any supported schema format to AI SDK Schema
- `convertSchemaToZod(schema)` - Convert AI SDK Schema, JSON Schema, or Standard JSON Schema to Zod
- `isZodType(value)` - Check if a value is a Zod schema
- `isStandardSchema(value)` - Check if a value implements Standard Schema
- `isStandardJSONSchema(value)` - Check if a value implements Standard JSON Schema

### Types and Constants

- `StandardSchemaV1` - Standard Schema V1 interface for runtime validation (has `~standard.validate()`)
- `StandardJSONSchemaV1` - Standard JSON Schema V1 interface for JSON Schema generation (has `~standard.jsonSchema.input()`)
- `AnySchema` - Union type of all supported schema formats (Zod, JSON Schema, Standard Schema, AI SDK Schema)
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
