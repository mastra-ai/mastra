import { openai } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { createTool } from '../../tools';
import 'dotenv/config';

type Result = {
  modelName: string;
  modelProvider: string;
  testName: string;
  status: 'success' | 'failure' | 'error' | 'expected-error';
  error: string | null;
  receivedContext: any;
  testId: string;
};

enum TestEnum {
  A = 'A',
  B = 'B',
  C = 'C',
}

// Define all schema tests
const allSchemas = {
  // String types
  string: z.string(),
  stringMin: z.string().min(1),
  stringMax: z.string().max(10),
  stringEmail: z.string().email(),
  stringEmoji: z.string().emoji(),
  stringUrl: z.string().url(),
  stringUuid: z.string().uuid(),
  stringCuid: z.string().cuid(),
  stringRegex: z.string().regex(/^test-/),

  // Number types
  number: z.number(),
  numberGt: z.number().gt(3),
  numberLt: z.number().lt(1),
  numberGte: z.number().gte(1),
  numberLte: z.number().lte(1),
  numberMultipleOf: z.number().multipleOf(2),
  numberInt: z.number().int(),

  // Array types
  array: z.array(z.string()),
  arrayMin: z.array(z.string()).min(1),
  arrayMax: z.array(z.string()).max(5),

  // Object types
  object: z.object({ foo: z.string(), bar: z.number() }),
  objectNested: z.object({
    user: z.object({
      name: z.string().min(2),
      age: z.number().gte(18),
    }),
  }),
  objectPassthrough: z.object({}).passthrough().describe('add something in this object'),

  // Optional and nullable
  optional: z.string().optional(),
  nullable: z.string().nullable(),

  // Enums
  enum: z.enum(['A', 'B', 'C']),
  nativeEnum: z.nativeEnum(TestEnum),

  // Union types
  unionPrimitives: z.union([z.string(), z.number()]),
  unionObjects: z.union([
    z.object({ amount: z.number(), name: z.string() }),
    z.object({ type: z.string(), permissions: z.array(z.string()) }),
  ]),

  // Default values
  default: z.string().default('test'),

  // Uncategorized types, not supported by OpenAI reasoning models
  anyOptional: z.any().optional(),
  any: z.any(),
  intersection: z.intersection(z.string().min(1), z.string().max(4)),
  never: z.never() as any,
  null: z.null(),
  tuple: z.tuple([z.string(), z.number(), z.boolean()]),
  undefined: z.undefined(),
} as const;

type SchemaMap = typeof allSchemas;
type SchemaKey = keyof SchemaMap;

// Function to create a subset of schemas for testing
function createTestSchemas(schemaKeys: SchemaKey[] = []): z.ZodObject<any> {
  if (schemaKeys.length === 0) {
    return z.object(allSchemas);
  }

  const selectedSchemas = Object.fromEntries(schemaKeys.map(key => [key, allSchemas[key]]));

  // We know these are valid Zod schemas since they come from allSchemas
  return z.object(selectedSchemas as Record<string, z.ZodType>);
}

async function runSingleOutputsTest(
  model: LanguageModel,
  testTool: ReturnType<typeof createTool>,
  testId: string,
  toolName: string,
): Promise<Result> {
  try {
    const agent = new Agent({
      name: `test-agent-${model.modelId}`,
      instructions: `You are a test agent. Your task is to make sure that the output returned is in the right shape. This is very important as it's your primary purpose`,
      model: model,
    });

    const response = await agent.generate(`Please output some example data in the right schema shape.`, {
      toolChoice: 'required',
      maxSteps: 1,
      output: testTool.inputSchema,
    });

    return {
      modelName: model.modelId,
      modelProvider: model.provider,
      testName: toolName,
      status: 'success',
      error: null,
      receivedContext: response.object,
      testId,
    };
  } catch (e: any) {
    let status: Result['status'] = 'error';
    if (e.message.includes('does not support zod type:')) {
      status = 'expected-error';
    }
    if (e.name === 'AI_NoObjectGeneratedError') {
      status = 'failure';
    }
    return {
      modelName: model.modelId,
      testName: toolName,
      modelProvider: model.provider,
      status,
      error: e.message,
      receivedContext: null,
      testId,
    };
  }
}

async function runSingleInputTest(
  model: LanguageModel,
  testTool: ReturnType<typeof createTool>,
  testId: string,
  toolName: string,
): Promise<Result> {
  try {
    const agent = new Agent({
      name: `test-agent-${model.modelId}`,
      instructions: `You are a test agent. Your task is to call the tool named '${toolName}' with any valid arguments. This is very important as it's your primary purpose`,
      model: model,
      tools: { [toolName]: testTool },
    });

    const response = await agent.generate(`Please call the tool named '${toolName}'.`, {
      toolChoice: 'required',
      maxSteps: 1,
    });

    const toolCall = response.toolCalls.find(tc => tc.toolName === toolName);
    const toolResult = response.toolResults.find(tr => tr.toolCallId === toolCall?.toolCallId);

    if (toolResult?.result?.success) {
      return {
        modelName: model.modelId,
        modelProvider: model.provider,
        testName: toolName,
        status: 'success',
        error: null,
        receivedContext: toolResult.result.receivedContext,
        testId,
      };
    } else {
      const error = toolResult?.result?.error || response.text || 'Tool call failed or result missing';
      return {
        modelName: model.modelId,
        testName: toolName,
        modelProvider: model.provider,
        status: 'failure',
        error: error,
        receivedContext: toolResult?.result?.receivedContext || null,
        testId,
      };
    }
  } catch (e: any) {
    let status: Result['status'] = 'error';
    if (e.message.includes('does not support zod type:')) {
      status = 'expected-error';
    }
    return {
      modelName: model.modelId,
      testName: toolName,
      modelProvider: model.provider,
      status,
      error: e.message,
      receivedContext: null,
      testId,
    };
  }
}

describe('Tool Schema Compatibility', () => {
  // Set a longer timeout for the entire test suite
  const SUITE_TIMEOUT = 120000; // 2 minutes
  const TEST_TIMEOUT = 60000; // 1 minute

  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY environment variable is required');
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

  const modelsToTest = [
    // Anthropic Models
    openrouter('anthropic/claude-3.7-sonnet'),
    openrouter('anthropic/claude-3.5-sonnet'),
    openrouter('anthropic/claude-3.5-haiku'),

    // NOTE: Google models accept number constraints like numberLt, but the models don't respect it and returns a wrong response often
    // Unions of objects are not supported
    // Google Models
    openrouter('google/gemini-2.5-pro-preview-03-25'),
    openrouter('google/gemini-2.5-flash'),
    openrouter('google/gemini-2.0-flash-lite-001'),

    // OpenAI Models
    openrouter('openai/gpt-4o-mini'),
    openrouter('openai/gpt-4.1-mini'),
    // openrouter disables structured outputs by default for o3-mini, so added in a reasoning model not through openrouter to test
    openai('o3-mini'),
    openai('o4-mini'),

    // Meta Models
    // Meta often calls the tool with the wrong name, ie 'tesTool_number'/'TestTool_number' instead of 'testTool_number'
    // There is a compatibility layer added for it, which does seem to help a bit, but it still errors enough to not want it to be in the test suite
    // so commenting out for now
    // openrouter('meta-llama/llama-4-maverick'),

    // Other Models
    // deepseek randomly doesn't call the tool so the check fails. It seems to handle the tool call correctly though when it does call it
    // There is a compatibility layer added for it, but it still errors enough to not want it to be in the test suite
    // openrouter('deepseek/deepseek-chat-v3-0324'),
  ];

  // Specify which schemas to test - empty array means test all
  // To test specific schemas, add their names to this array
  // Example: ['string', 'number'] to test only string and number schemas
  const schemasToTest: SchemaKey[] = [];
  const testSchemas = createTestSchemas(schemasToTest);

  // Helper to check if a model is from Google
  const isGoogleModel = (model: LanguageModel) =>
    model.provider.includes('google') || model.modelId.includes('google/gemini');

  // Create test tools for each schema type
  const testTools = Object.entries(testSchemas.shape).map(([key, schema]) => {
    const tool = {
      id: `testTool_${key}` as const,
      description: `Test tool for schema type: ${key}. Call this tool to test the schema.`,
      inputSchema: z.object({ [key]: schema as z.ZodTypeAny }),
      execute: async ({ context }) => {
        return { success: true, receivedContext: context };
      },
    } as const;

    return createTool(tool);
  });

  // Group tests by model provider for better organization
  const modelsByProvider = modelsToTest.reduce(
    (acc, model) => {
      const provider = model.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, (typeof modelsToTest)[number][]>,
  );

  // Run tests concurrently at both the provider and model level
  Object.entries(modelsByProvider).forEach(([provider, models]) => {
    describe.concurrent(`Input Schema Compatibility: ${provider} Models`, { timeout: SUITE_TIMEOUT }, () => {
      models.forEach(model => {
        describe.concurrent(`${model.modelId}`, { timeout: SUITE_TIMEOUT }, () => {
          testTools.forEach(testTool => {
            const schemaName = testTool.id.replace('testTool_', '');

            // Google does not support unions of objects and is flakey withnulls
            if (isGoogleModel(model) && (testTool.id.includes('unionObjects') || testTool.id.includes('null'))) {
              it.skip(`should handle ${schemaName} schema (skipped for ${provider})`, () => {});
              return;
            }

            it.concurrent(
              `should handle ${schemaName} schema`,
              async () => {
                let result = await runSingleInputTest(model, testTool, crypto.randomUUID(), testTool.id);

                // Sometimes models are flaky, if it's not an API error, run it again
                if (result.status === 'failure') {
                  console.log(`Possibly flake from model ${model.modelId}, running ${schemaName} again`);
                  result = await runSingleInputTest(model, testTool, crypto.randomUUID(), testTool.id);
                }

                if (result.status !== 'success' && result.status !== 'expected-error') {
                  console.error(`Error for ${model.modelId} - ${schemaName}:`, result.error);
                }

                if (result.status === 'expected-error') {
                  expect(result.status).toBe('expected-error');
                } else {
                  expect(result.status).toBe('success');
                }
              },
              TEST_TIMEOUT,
            );
          });
        });
      });
    });

    // Skipping these tests for now as LLM's seem to be flakier with output schemas than tool input schemas
    // The compatibility layer still fixes things in the same way, output schemas and input schemas fail in a similar way for a model
    // but the LLM sometimes makes silly mistakes with output schemas, like returning a json string instead of an object or not returning anything.
    // Skipping this also saves us a lot of cost in CI for running tests. I'll keep the tests here for now if we ever want to test it manually.
    describe(`Output Schema Compatibility: ${provider} Models`, { timeout: SUITE_TIMEOUT }, () => {
      models.forEach(model => {
        describe.skip(`${model.modelId}`, { timeout: SUITE_TIMEOUT }, () => {
          testTools.forEach(testTool => {
            const schemaName = testTool.id.replace('testTool_', '');

            it.concurrent(
              `should handle ${schemaName} schema`,
              async () => {
                let result = await runSingleOutputsTest(model, testTool, crypto.randomUUID(), testTool.id);

                // Sometimes models are flaky, run it again if it fails
                if (result.status === 'failure') {
                  console.log(`Possibly flake from model ${model.modelId}, running ${schemaName} again`);
                  result = await runSingleOutputsTest(model, testTool, crypto.randomUUID(), testTool.id);
                }

                if (result.status !== 'success' && result.status !== 'expected-error') {
                  console.error(`Error for ${model.modelId} - ${schemaName}:`, result.error);
                }

                if (result.status === 'expected-error') {
                  expect(result.status).toBe('expected-error');
                } else {
                  expect(result.status).toBe('success');
                }
              },
              TEST_TIMEOUT,
            );
          });
        });
      });
    });
  });
});
