# @mastra/schema-compat

Schema compatibility utilities that adapt Zod and JSON schemas to the different subsets and formats supported by AI model providers. Mastra uses these layers when tool inputs or structured outputs contain schema features a provider cannot accept directly.

## Installation

```bash
npm install @mastra/schema-compat
```

## Usage

Apply a provider layer to a Zod schema before passing it to an AI SDK API:

```typescript
import { applyCompatLayer, OpenAISchemaCompatLayer } from '@mastra/schema-compat';
import { z } from 'zod';

const model = {
  provider: 'openai.chat',
  modelId: 'gpt-5.2',
  supportsStructuredOutputs: true,
};

const schema = z.object({
  name: z.string().email(),
  tags: z.array(z.string()).min(1),
});

const compatibleSchema = applyCompatLayer({
  schema,
  compatLayers: [new OpenAISchemaCompatLayer(model)],
  mode: 'aiSdkSchema',
});
```

## Documentation

The package includes compatibility layers for Anthropic, DeepSeek, Google, Meta, OpenAI, and OpenAI reasoning models. A layer decides whether it applies to the supplied model information, selects the provider's schema target, and rewrites unsupported checks or structures without changing the application's source schema.

`applyCompatLayer()` chooses the first applicable layer and returns either an AI SDK schema or JSON Schema. `convertZodSchemaToAISDKSchema()` converts Zod directly, while `convertSchemaToZod()` converts supported schema inputs back to Zod. Standard Schema helpers are available for extracting schemas, converting them to JSON Schema, and applying OpenAI compatibility transforms to tools.

The package supports both Zod v3 and v4. `SchemaCompatLayerV3` and `SchemaCompatLayerV4` expose version-specific APIs, while `SchemaCompatLayer` dispatches based on the schema version. Utilities such as `prepareJsonSchemaForOpenAIStrictMode()` and `ensureAllPropertiesRequired()` handle strict structured-output requirements.

Provider layers commonly remove unsupported refinements, convert validation rules into descriptions, normalize nullable and union types, and target JSON Schema 7 or OpenAPI-compatible output as required by the provider.

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/schema-compat/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
