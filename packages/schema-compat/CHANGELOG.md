# @mastra/schema-compat

## 1.1.3-alpha.0

### Patch Changes

- Fix `ZodNull` throwing "does not support zod type: ZodNull" for Anthropic and OpenAI reasoning models. MCP tools with nullable properties in their JSON Schema produce `z.null()` which was unhandled by these provider compat layers. ([#13496](https://github.com/mastra-ai/mastra/pull/13496))

## 1.1.2

### Patch Changes

- Fixed Groq provider not receiving schema compatibility transformations, which caused HTTP 400 errors when AI models omitted optional parameters from workspace tool calls (e.g. list_files). Groq now correctly gets the same optional-to-nullable schema handling as OpenAI. ([#13303](https://github.com/mastra-ai/mastra/pull/13303))

## 1.1.2-alpha.0

### Patch Changes

- Fixed Groq provider not receiving schema compatibility transformations, which caused HTTP 400 errors when AI models omitted optional parameters from workspace tool calls (e.g. list_files). Groq now correctly gets the same optional-to-nullable schema handling as OpenAI. ([#13303](https://github.com/mastra-ai/mastra/pull/13303))

## 1.1.1

### Patch Changes

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

## 1.1.1-alpha.0

### Patch Changes

- fix(schema-compat): fix zodToJsonSchema routing for v3/v4 Zod schemas ([#13253](https://github.com/mastra-ai/mastra/pull/13253))

  The `zodToJsonSchema` function now reliably detects and routes Zod v3 vs v4 schemas regardless of which version the ambient `zod` import resolves to. Previously, the detection relied on checking `'toJSONSchema' in z` against the ambient `z` import, which could resolve to either v3 or v4 depending on the environment (monorepo vs global install). This caused v3 schemas to be passed to v4's `toJSONSchema()` (crashing with "Cannot read properties of undefined (reading 'def')") or v4 schemas to be passed to the v3 converter (producing schemas missing the `type` field).

  The fix explicitly imports `z as zV4` from `zod/v4` and routes based on the schema's own `_zod` property, making the behavior environment-independent.

  Also migrates all mastracode tool files from `zod/v3` to `zod` imports now that the schema-compat fix supports both versions correctly.

## 1.1.0

### Minor Changes

- Added [Standard Schema](https://github.com/standard-schema/standard-schema) support to `@mastra/schema-compat`. This enables interoperability with any schema library that implements the Standard Schema specification. ([#12527](https://github.com/mastra-ai/mastra/pull/12527))

  **New exports:**
  - `toStandardSchema()` - Convert Zod, JSON Schema, or AI SDK schemas to Standard Schema format
  - `StandardSchemaWithJSON` - Type for schemas implementing both validation and JSON Schema conversion
  - `InferInput`, `InferOutput` - Utility types for type inference

  **Example usage:**

  ```typescript
  import { toStandardSchema } from '@mastra/schema-compat/schema';
  import { z } from 'zod';

  // Convert a Zod schema to Standard Schema
  const zodSchema = z.object({ name: z.string(), age: z.number() });
  const standardSchema = toStandardSchema(zodSchema);

  // Use validation
  const result = standardSchema['~standard'].validate({ name: 'John', age: 30 });

  // Get JSON Schema
  const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
  ```

## 1.1.0-alpha.0

### Minor Changes

- Added [Standard Schema](https://github.com/standard-schema/standard-schema) support to `@mastra/schema-compat`. This enables interoperability with any schema library that implements the Standard Schema specification. ([#12527](https://github.com/mastra-ai/mastra/pull/12527))

  **New exports:**
  - `toStandardSchema()` - Convert Zod, JSON Schema, or AI SDK schemas to Standard Schema format
  - `StandardSchemaWithJSON` - Type for schemas implementing both validation and JSON Schema conversion
  - `InferInput`, `InferOutput` - Utility types for type inference

  **Example usage:**

  ```typescript
  import { toStandardSchema } from '@mastra/schema-compat/schema';
  import { z } from 'zod';

  // Convert a Zod schema to Standard Schema
  const zodSchema = z.object({ name: z.string(), age: z.number() });
  const standardSchema = toStandardSchema(zodSchema);

  // Use validation
  const result = standardSchema['~standard'].validate({ name: 'John', age: 30 });

  // Get JSON Schema
  const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
  ```

## 1.0.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- Fix Zod v4 toJSONSchema bug with z.record() single-argument form ([#9265](https://github.com/mastra-ai/mastra/pull/9265))

  Zod v4 has a bug in the single-argument form of `z.record(valueSchema)` where it incorrectly assigns the value schema to `keyType` instead of `valueType`, leaving `valueType` undefined. This causes `toJSONSchema()` to throw "Cannot read properties of undefined (reading '\_zod')" when processing schemas containing `z.record()` fields.

  This fix patches affected schemas before conversion by detecting records with missing `valueType` and correctly assigning the schema to `valueType` while setting `keyType` to `z.string()` (the default). The patch recursively handles nested schemas including those wrapped in `.optional()`, `.nullable()`, arrays, unions, and objects.

- Embed AI types to fix peerdeps mismatches ([`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808))

- Fixed agent network mode failing with "Cannot read properties of undefined" error when tools or workflows don't have an `inputSchema` defined. ([#12063](https://github.com/mastra-ai/mastra/pull/12063))
  - **@mastra/core:** Fixed `getRoutingAgent()` to handle tools and workflows without `inputSchema` by providing a default empty schema fallback.
  - **@mastra/schema-compat:** Fixed Zod v4 optional/nullable fields producing invalid JSON schema for OpenAI structured outputs. OpenAI now correctly receives `type: ["string", "null"]` instead of `anyOf` patterns that were rejected with "must have a 'type' key" error.

- Fixed OpenAI schema validation error when using passthrough schemas with tools like `vectorQueryTool`. ([#11846](https://github.com/mastra-ai/mastra/pull/11846))

  **What was happening:** Tools using `.passthrough()` or `z.looseObject()` schemas (like the RAG `vectorQueryTool`) would fail with OpenAI models, returning the error: "Invalid schema for function: In context=('additionalProperties',), schema must have a 'type' key."

  **What changed:** The OpenAI schema compatibility layer now converts passthrough schemas to strict object schemas, producing valid `additionalProperties: false` instead of the invalid empty object `{}` that Zod v4 generates.

  Fixes #11823

- Fixed "Transforms cannot be represented in JSON Schema" error when using Zod v4 with structuredOutput ([#11466](https://github.com/mastra-ai/mastra/pull/11466))

  When using schemas with `.optional()`, `.nullable()`, `.default()`, or `.nullish().default("")` patterns with `structuredOutput` and Zod v4, users would encounter an error because OpenAI schema compatibility layer adds transforms that Zod v4's native `toJSONSchema()` cannot handle.

  The fix uses Mastra's transform-safe `zodToJsonSchema` function which gracefully handles transforms by using the `unrepresentable: 'any'` option.

  Also exported `isZodType` utility from `@mastra/schema-compat` and updated it to detect both Zod v3 (`_def`) and Zod v4 (`_zod`) schemas.

- Improved reliability of string field types in tool schema compatibility ([#9266](https://github.com/mastra-ai/mastra/pull/9266))

- Fix OpenAI structured output compatibility for fields with `.default()` values ([#11434](https://github.com/mastra-ai/mastra/pull/11434))

  When using Zod schemas with `.default()` fields (e.g., `z.number().default(1)`), OpenAI's structured output API was failing with errors like `Missing '<field>' in required`. This happened because `zod-to-json-schema` doesn't include fields with defaults in the `required` array, but OpenAI requires all properties to be required.

  This fix converts `.default()` fields to `.nullable()` with a transform that returns the default value when `null` is received, ensuring compatibility with OpenAI's strict mode while preserving the original default value semantics.

- fix(schema-compat): handle undefined values in optional fields for OpenAI compat layers ([#11469](https://github.com/mastra-ai/mastra/pull/11469))

  When a Zod schema has nested objects with `.partial()`, the optional fields would fail validation with "expected string, received undefined" errors. This occurred because the OpenAI schema compat layer converted `.optional()` to `.nullable()`, which only accepts `null` values, not `undefined`.

  Changed `.nullable()` to `.nullish()` so that optional fields now accept both `null` (when explicitly provided by the LLM) and `undefined` (when fields are omitted entirely).

  Fixes #11457

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

- Fix oneOf schema conversion generating invalid JavaScript ([#11626](https://github.com/mastra-ai/mastra/pull/11626))

  The upstream json-schema-to-zod library generates TypeScript syntax (`reduce<z.ZodError[]>`) when converting oneOf schemas. This TypeScript generic annotation fails when evaluated at runtime with Function(), causing schema resolution to fail.

  The fix removes TypeScript generic syntax from the generated output, producing valid JavaScript that can be evaluated at runtime. This resolves issues where MCP tools with oneOf in their output schemas would fail validation.

- Fixed OpenAI schema compatibility when using `agent.generate()` or `agent.stream()` with `structuredOutput`. ([#10366](https://github.com/mastra-ai/mastra/pull/10366))

  **Changes**
  - **Automatic transformation**: Zod schemas are now automatically transformed for OpenAI strict mode compatibility when using OpenAI models (including reasoning models like o1, o3, o4)
  - **Optional field handling**: `.optional()` fields are converted to `.nullable()` with a transform that converts `null` → `undefined`, preserving optional semantics while satisfying OpenAI's strict mode requirements
  - **Preserves nullable fields**: Intentionally `.nullable()` fields remain unchanged
  - **Deep transformation**: Handles `.optional()` fields at any nesting level (objects, arrays, unions, etc.)
  - **JSON Schema objects**: Not transformed, only Zod schemas

  **Example**

  ```typescript
  const agent = new Agent({
    name: 'data-extractor',
    model: { provider: 'openai', modelId: 'gpt-4o' },
    instructions: 'Extract user information',
  });

  const schema = z.object({
    name: z.string(),
    age: z.number().optional(),
    deletedAt: z.date().nullable(),
  });

  // Schema is automatically transformed for OpenAI compatibility
  const result = await agent.generate('Extract: John, deleted yesterday', {
    structuredOutput: { schema },
  });

  // Result: { name: 'John', age: undefined, deletedAt: null }
  ```

## 1.0.0-beta.8

### Patch Changes

- Fixed agent network mode failing with "Cannot read properties of undefined" error when tools or workflows don't have an `inputSchema` defined. ([#12063](https://github.com/mastra-ai/mastra/pull/12063))
  - **@mastra/core:** Fixed `getRoutingAgent()` to handle tools and workflows without `inputSchema` by providing a default empty schema fallback.
  - **@mastra/schema-compat:** Fixed Zod v4 optional/nullable fields producing invalid JSON schema for OpenAI structured outputs. OpenAI now correctly receives `type: ["string", "null"]` instead of `anyOf` patterns that were rejected with "must have a 'type' key" error.

## 1.0.0-beta.7

### Patch Changes

- Fixed OpenAI schema validation error when using passthrough schemas with tools like `vectorQueryTool`. ([#11846](https://github.com/mastra-ai/mastra/pull/11846))

  **What was happening:** Tools using `.passthrough()` or `z.looseObject()` schemas (like the RAG `vectorQueryTool`) would fail with OpenAI models, returning the error: "Invalid schema for function: In context=('additionalProperties',), schema must have a 'type' key."

  **What changed:** The OpenAI schema compatibility layer now converts passthrough schemas to strict object schemas, producing valid `additionalProperties: false` instead of the invalid empty object `{}` that Zod v4 generates.

  Fixes #11823

## 1.0.0-beta.6

### Patch Changes

- Fix oneOf schema conversion generating invalid JavaScript ([#11626](https://github.com/mastra-ai/mastra/pull/11626))

  The upstream json-schema-to-zod library generates TypeScript syntax (`reduce<z.ZodError[]>`) when converting oneOf schemas. This TypeScript generic annotation fails when evaluated at runtime with Function(), causing schema resolution to fail.

  The fix removes TypeScript generic syntax from the generated output, producing valid JavaScript that can be evaluated at runtime. This resolves issues where MCP tools with oneOf in their output schemas would fail validation.

## 1.0.0-beta.5

### Patch Changes

- Fixed "Transforms cannot be represented in JSON Schema" error when using Zod v4 with structuredOutput ([#11466](https://github.com/mastra-ai/mastra/pull/11466))

  When using schemas with `.optional()`, `.nullable()`, `.default()`, or `.nullish().default("")` patterns with `structuredOutput` and Zod v4, users would encounter an error because OpenAI schema compatibility layer adds transforms that Zod v4's native `toJSONSchema()` cannot handle.

  The fix uses Mastra's transform-safe `zodToJsonSchema` function which gracefully handles transforms by using the `unrepresentable: 'any'` option.

  Also exported `isZodType` utility from `@mastra/schema-compat` and updated it to detect both Zod v3 (`_def`) and Zod v4 (`_zod`) schemas.

- fix(schema-compat): handle undefined values in optional fields for OpenAI compat layers ([#11469](https://github.com/mastra-ai/mastra/pull/11469))

  When a Zod schema has nested objects with `.partial()`, the optional fields would fail validation with "expected string, received undefined" errors. This occurred because the OpenAI schema compat layer converted `.optional()` to `.nullable()`, which only accepts `null` values, not `undefined`.

  Changed `.nullable()` to `.nullish()` so that optional fields now accept both `null` (when explicitly provided by the LLM) and `undefined` (when fields are omitted entirely).

  Fixes #11457

## 1.0.0-beta.4

### Patch Changes

- Fix OpenAI structured output compatibility for fields with `.default()` values ([#11434](https://github.com/mastra-ai/mastra/pull/11434))

  When using Zod schemas with `.default()` fields (e.g., `z.number().default(1)`), OpenAI's structured output API was failing with errors like `Missing '<field>' in required`. This happened because `zod-to-json-schema` doesn't include fields with defaults in the `required` array, but OpenAI requires all properties to be required.

  This fix converts `.default()` fields to `.nullable()` with a transform that returns the default value when `null` is received, ensuring compatibility with OpenAI's strict mode while preserving the original default value semantics.

## 1.0.0-beta.3

### Patch Changes

- Embed AI types to fix peerdeps mismatches ([`9650cce`](https://github.com/mastra-ai/mastra/commit/9650cce52a1d917ff9114653398e2a0f5c3ba808))

## 1.0.0-beta.2

### Patch Changes

- Fix discriminatedUnion schema information lost when json schema is converted to zod ([#10500](https://github.com/mastra-ai/mastra/pull/10500))

## 1.0.0-beta.1

### Patch Changes

- Fixed OpenAI schema compatibility when using `agent.generate()` or `agent.stream()` with `structuredOutput`. ([#10366](https://github.com/mastra-ai/mastra/pull/10366))

  ## Changes
  - **Automatic transformation**: Zod schemas are now automatically transformed for OpenAI strict mode compatibility when using OpenAI models (including reasoning models like o1, o3, o4)
  - **Optional field handling**: `.optional()` fields are converted to `.nullable()` with a transform that converts `null` → `undefined`, preserving optional semantics while satisfying OpenAI's strict mode requirements
  - **Preserves nullable fields**: Intentionally `.nullable()` fields remain unchanged
  - **Deep transformation**: Handles `.optional()` fields at any nesting level (objects, arrays, unions, etc.)
  - **JSON Schema objects**: Not transformed, only Zod schemas

  ## Example

  ```typescript
  const agent = new Agent({
    name: 'data-extractor',
    model: { provider: 'openai', modelId: 'gpt-4o' },
    instructions: 'Extract user information',
  });

  const schema = z.object({
    name: z.string(),
    age: z.number().optional(),
    deletedAt: z.date().nullable(),
  });

  // Schema is automatically transformed for OpenAI compatibility
  const result = await agent.generate('Extract: John, deleted yesterday', {
    structuredOutput: { schema },
  });

  // Result: { name: 'John', age: undefined, deletedAt: null }
  ```

## 1.0.0-beta.0

### Major Changes

- Bump minimum required Node.js version to 22.13.0 ([#9706](https://github.com/mastra-ai/mastra/pull/9706))

- Mark as stable ([`83d5942`](https://github.com/mastra-ai/mastra/commit/83d5942669ce7bba4a6ca4fd4da697a10eb5ebdc))

### Patch Changes

- Fix Zod v4 toJSONSchema bug with z.record() single-argument form ([#9265](https://github.com/mastra-ai/mastra/pull/9265))

  Zod v4 has a bug in the single-argument form of `z.record(valueSchema)` where it incorrectly assigns the value schema to `keyType` instead of `valueType`, leaving `valueType` undefined. This causes `toJSONSchema()` to throw "Cannot read properties of undefined (reading '\_zod')" when processing schemas containing `z.record()` fields.

  This fix patches affected schemas before conversion by detecting records with missing `valueType` and correctly assigning the schema to `valueType` while setting `keyType` to `z.string()` (the default). The patch recursively handles nested schemas including those wrapped in `.optional()`, `.nullable()`, arrays, unions, and objects.

- Improved reliability of string field types in tool schema compatibility ([#9266](https://github.com/mastra-ai/mastra/pull/9266))

## 0.11.4

### Patch Changes

- Fixes an issue when the OpenAI reasoning schema compatibility layer was calling defaultValue() as a function, which works in Zod v3 but fails in Zod v4 where defaultValue is stored directly as a value. ([#8090](https://github.com/mastra-ai/mastra/pull/8090))

## 0.11.4-alpha.0

### Patch Changes

- Fixes an issue when the OpenAI reasoning schema compatibility layer was calling defaultValue() as a function, which works in Zod v3 but fails in Zod v4 where defaultValue is stored directly as a value. ([#8090](https://github.com/mastra-ai/mastra/pull/8090))

## 0.11.3

### Patch Changes

- Change SchemaCompat zodToJsonSchema ref strategy from none to relative, leading to less schema warnings and smaller converted schema sizes ([#7697](https://github.com/mastra-ai/mastra/pull/7697))

## 0.11.3-alpha.0

### Patch Changes

- Change SchemaCompat zodToJsonSchema ref strategy from none to relative, leading to less schema warnings and smaller converted schema sizes ([#7697](https://github.com/mastra-ai/mastra/pull/7697))

## 0.11.2

### Patch Changes

- ab48c97: dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)
- 637f323: Fix issue with some compilers and calling zod v4's toJSONSchema function
- de3cbc6: Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.
- 45e4d39: Try fixing the `Attempted import error: 'z'.'toJSONSchema' is not exported from 'zod'` error by tricking the compiler

## 0.11.2-alpha.3

### Patch Changes

- [#7350](https://github.com/mastra-ai/mastra/pull/7350) [`45e4d39`](https://github.com/mastra-ai/mastra/commit/45e4d391a2a09fc70c48e4d60f505586ada1ba0e) Thanks [@LekoArts](https://github.com/LekoArts)! - Try fixing the `Attempted import error: 'z'.'toJSONSchema' is not exported from 'zod'` error by tricking the compiler

## 0.11.2-alpha.2

### Patch Changes

- [#7343](https://github.com/mastra-ai/mastra/pull/7343) [`de3cbc6`](https://github.com/mastra-ai/mastra/commit/de3cbc61079211431bd30487982ea3653517278e) Thanks [@LekoArts](https://github.com/LekoArts)! - Update the `package.json` file to include additional fields like `repository`, `homepage` or `files`.

## 0.11.2-alpha.1

### Patch Changes

- [#5816](https://github.com/mastra-ai/mastra/pull/5816) [`ab48c97`](https://github.com/mastra-ai/mastra/commit/ab48c979098ea571faf998a55d3a00e7acd7a715) Thanks [@dane-ai-mastra](https://github.com/apps/dane-ai-mastra)! - dependencies updates:
  - Updated dependency [`zod-to-json-schema@^3.24.6` ↗︎](https://www.npmjs.com/package/zod-to-json-schema/v/3.24.6) (from `^3.24.5`, in `dependencies`)

## 0.11.2-alpha.0

### Patch Changes

- [#7121](https://github.com/mastra-ai/mastra/pull/7121) [`637f323`](https://github.com/mastra-ai/mastra/commit/637f32371d79a8f78c52c0d53411af0915fcec67) Thanks [@DanielSLew](https://github.com/DanielSLew)! - Fix issue with some compilers and calling zod v4's toJSONSchema function

## 0.11.1

### Patch Changes

- [`c6113ed`](https://github.com/mastra-ai/mastra/commit/c6113ed7f9df297e130d94436ceee310273d6430) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix peerdpes for @mastra/core

## 0.11.0

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

### Patch Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix exportsmap

- [#6982](https://github.com/mastra-ai/mastra/pull/6982) [`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix AI peerdeps for NPM install

- [#6944](https://github.com/mastra-ai/mastra/pull/6944) [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7) Thanks [@wardpeet](https://github.com/wardpeet)! - Add support for zod v4

## 0.11.0-alpha.2

### Minor Changes

- [#7032](https://github.com/mastra-ai/mastra/pull/7032) [`1191ce9`](https://github.com/mastra-ai/mastra/commit/1191ce946b40ed291e7877a349f8388e3cff7e5c) Thanks [@wardpeet](https://github.com/wardpeet)! - Bump zod peerdep to 3.25.0 to support both v3/v4

## 0.10.6-alpha.1

### Patch Changes

- [#7028](https://github.com/mastra-ai/mastra/pull/7028) [`da58ccc`](https://github.com/mastra-ai/mastra/commit/da58ccc1f2ac33da0cb97b00443fc6208b45bdec) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix exportsmap

## 0.10.6-alpha.0

### Patch Changes

- [#6982](https://github.com/mastra-ai/mastra/pull/6982) [`94e9f54`](https://github.com/mastra-ai/mastra/commit/94e9f547d66ef7cd01d9075ab53b5ca9a1cae100) Thanks [@wardpeet](https://github.com/wardpeet)! - Fix AI peerdeps for NPM install

- [#6944](https://github.com/mastra-ai/mastra/pull/6944) [`a93f3ba`](https://github.com/mastra-ai/mastra/commit/a93f3ba05eef4cf17f876d61d29cf0841a9e70b7) Thanks [@wardpeet](https://github.com/wardpeet)! - Add support for zod v4

## 0.10.7

### Patch Changes

- dd94a26: Dont rely on the full language model for schema compat
- 2fff911: Fix vnext working memory tool schema when model is incompatible with schema
- ae2eb63: Handle regex checks better, return description as a string rather than an object with pattern and flags.

## 0.10.7-alpha.1

### Patch Changes

- ae2eb63: Handle regex checks better, return description as a string rather than an object with pattern and flags.

## 0.10.7-alpha.0

### Patch Changes

- dd94a26: Dont rely on the full language model for schema compat
- 2fff911: Fix vnext working memory tool schema when model is incompatible with schema

## 0.10.6

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.6-alpha.0

### Patch Changes

- 4a406ec: fixes TypeScript declaration file imports to ensure proper ESM compatibility

## 0.10.5

### Patch Changes

- 4da943f: Fix Cannot read properties of undefined (reading 'typeName') in schema compat check

## 0.10.5-alpha.0

### Patch Changes

- 4da943f: Fix Cannot read properties of undefined (reading 'typeName') in schema compat check

## 0.10.4

### Patch Changes

- 0c85311: Fix Google models ZodNull tool schema handling

## 0.10.4-alpha.0

### Patch Changes

- 0c85311: Fix Google models ZodNull tool schema handling

## 0.10.3

### Patch Changes

- 98bbe5a: Claude cannot handle tuple schemas now.
- a853c43: Allow for object.passthrough in schema compat (aka MCP tool support).

## 0.10.3-alpha.1

### Patch Changes

- a853c43: Allow for object.passthrough in schema compat (aka MCP tool support).

## 0.10.3-alpha.0

### Patch Changes

- 98bbe5a: Claude cannot handle tuple schemas now.

## 0.10.2

### Patch Changes

- f6fd25f: Updates @mastra/schema-compat to allow all zod schemas. Uses @mastra/schema-compat to apply schema transformations to agent output schema.
- f9816ae: Create @mastra/schema-compat package to extract the schema compatibility layer to be used outside of mastra

## 0.10.2-alpha.3

### Patch Changes

- f6fd25f: Updates @mastra/schema-compat to allow all zod schemas. Uses @mastra/schema-compat to apply schema transformations to agent output schema.

## 0.10.2-alpha.2

### Patch Changes

- f9816ae: Create @mastra/schema-compat package to extract the schema compatibility layer to be used outside of mastra
