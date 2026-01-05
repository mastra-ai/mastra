/**
 * Multi-Library Tool Examples
 *
 * This file demonstrates how Mastra tools can be defined using different
 * validation libraries, all thanks to Standard Schema support.
 *
 * Key Points:
 * 1. Zod: Full support (JSON Schema + validation) - recommended
 * 2. ArkType: Full support (JSON Schema + validation) - great TypeScript inference
 * 3. Valibot: Validation only - needs separate JSON Schema generation
 */

import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';
import { asSchema } from '@ai-sdk/provider-utils';

// ============================================================================
// EXAMPLE 1: Weather Tool with Zod (Recommended)
// ============================================================================

// Zod schema - works out of the box with full type inference
const zodWeatherSchema = z.object({
  location: z.string().describe('City name or coordinates'),
  units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  days: z.number().int().min(1).max(14).describe('Number of forecast days'),
});

// In Mastra tool definition:
// createTool({
//   id: 'weather',
//   description: 'Get weather forecast',
//   inputSchema: zodWeatherSchema,  // ✅ Works directly!
//   execute: async (input) => {
//     // input is typed as { location: string; units: 'celsius' | 'fahrenheit'; days: number }
//     return { forecast: `Weather for ${input.location}` };
//   },
// });

// ============================================================================
// EXAMPLE 2: Database Query Tool with ArkType
// ============================================================================

// ArkType schema - great TypeScript inference, implements both Standard Schema interfaces
const arktypeQuerySchema = type({
  table: "'users' | 'orders' | 'products'",
  select: 'string[]',
  where: {
    field: 'string',
    operator: "'=' | '!=' | '>' | '<' | '>=' | '<='",
    value: 'string | number',
  },
  limit: 'number?',
  offset: 'number?',
});

// ArkType schemas work with AI SDK's asSchema:
const aiSdkSchema = asSchema(arktypeQuerySchema);

// In Mastra tool definition:
// createTool({
//   id: 'query-db',
//   description: 'Query the database',
//   inputSchema: arktypeQuerySchema,  // ✅ Works directly!
//   execute: async (input) => {
//     // input is typed from ArkType's inference
//     return { results: [] };
//   },
// });

// ============================================================================
// EXAMPLE 3: Search Tool with Valibot (Validation Only)
// ============================================================================

// Valibot schema - implements StandardSchemaV1 for validation
// Note: Valibot v1.x doesn't implement StandardJSONSchemaV1 for JSON Schema generation
const valibotSearchSchema = v.object({
  query: v.pipe(v.string(), v.minLength(1), v.maxLength(1000)),
  maxResults: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100))),
  filters: v.optional(
    v.object({
      dateFrom: v.optional(v.pipe(v.string(), v.isoDate())),
      dateTo: v.optional(v.pipe(v.string(), v.isoDate())),
      category: v.optional(v.picklist(['news', 'images', 'videos', 'all'])),
    }),
  ),
});

// For Valibot, you can use the Standard Schema validation directly:
async function validateWithValibot(input: unknown) {
  const result = await valibotSearchSchema['~standard'].validate(input);
  if ('value' in result) {
    console.log('Valid:', result.value);
    return result.value;
  } else {
    console.log('Errors:', result.issues);
    throw new Error(result.issues.map(i => i.message).join(', '));
  }
}

// ============================================================================
// EXAMPLE 4: How Mastra handles these schemas internally
// ============================================================================

/**
 * When you pass a schema to createTool, Mastra:
 *
 * 1. For TYPE INFERENCE (compile-time):
 *    - Uses ZodLikeSchema type which accepts both Zod and StandardSchemaV1
 *    - InferZodLikeSchema extracts the output type for the execute function
 *    - Priority: Zod's _output > parse return type > StandardSchemaV1.types.output
 *
 * 2. For JSON SCHEMA GENERATION (for LLMs):
 *    - AI SDK's asSchema() handles conversion:
 *      - Zod: Uses zod-to-json-schema
 *      - ArkType: Uses ~standard.jsonSchema.input()
 *      - Other Standard Schema: Falls back or warns
 *
 * 3. For VALIDATION (runtime):
 *    - Mastra's validateToolInput() checks:
 *      - If schema has safeParse (Zod), use it
 *      - Else if isStandardSchema, use ~standard.validate()
 *    - This means any Standard Schema library works for validation!
 */

// ============================================================================
// EXAMPLE 5: Type Inference Comparison
// ============================================================================

// Zod - full type inference
type ZodInput = z.infer<typeof zodWeatherSchema>;
// { location: string; units: "celsius" | "fahrenheit"; days: number }

// ArkType - full type inference
type ArkTypeInput = typeof arktypeQuerySchema.infer;
// { table: "users" | "orders" | "products"; select: string[]; ... }

// Valibot - full type inference
type ValibotInput = v.InferOutput<typeof valibotSearchSchema>;
// { query: string; maxResults?: number; filters?: { ... } }

// ============================================================================
// EXAMPLE 6: Using with Mastra's createTool
// ============================================================================

/*
import { createTool } from '@mastra/core/tools';

// Zod tool
const zodTool = createTool({
  id: 'zod-weather',
  description: 'Get weather with Zod schema',
  inputSchema: zodWeatherSchema,
  execute: async (input) => {
    // input.location is string
    // input.units is 'celsius' | 'fahrenheit'
    // input.days is number
    return { forecast: 'sunny' };
  },
});

// ArkType tool
const arktypeTool = createTool({
  id: 'arktype-query',
  description: 'Query database with ArkType schema',
  inputSchema: arktypeQuerySchema,
  execute: async (input) => {
    // input.table is 'users' | 'orders' | 'products'
    // input.select is string[]
    return { results: [] };
  },
});

// For Valibot, you'd need to provide JSON Schema separately or use a converter
// since Valibot doesn't implement StandardJSONSchemaV1
*/

// ============================================================================
// SUMMARY: Library Support Matrix
// ============================================================================

/*
| Library  | StandardSchemaV1 | StandardJSONSchemaV1 | Works with asSchema |
|----------|------------------|----------------------|---------------------|
| Zod 3.25+| ✅               | ✅ (via zod-to-json) | ✅                  |
| ArkType  | ✅               | ✅                   | ✅                  |
| Valibot  | ✅               | ❌ (v1.x)            | ⚠️ (validation only)|

For AI tools, you need BOTH interfaces because:
- StandardJSONSchemaV1: LLMs need JSON Schema to understand tool parameters
- StandardSchemaV1: Runtime validation of LLM-generated input

Recommendation: Use Zod or ArkType for full compatibility.
*/

export {
  zodWeatherSchema,
  arktypeQuerySchema,
  valibotSearchSchema,
  validateWithValibot,
};
