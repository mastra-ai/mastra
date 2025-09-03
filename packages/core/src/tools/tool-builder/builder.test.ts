import { openai } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import type { AnyAISpan } from '../../ai-tracing';
import { AISpanType } from '../../ai-tracing';
import { RuntimeContext } from '../../runtime-context';
import { createTool } from '../../tools';
import { CoreToolBuilder } from './builder';
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
  string: z.string().describe('I need any text'),
  stringMin: z.string().min(5).describe('I need any text with a minimum of 5 characters'),
  stringMax: z.string().max(10).describe('I need any text with a maximum of 10 characters'),
  stringEmail: z.string().email().describe('I need any text including a valid email address'),
  stringEmoji: z.string().emoji().describe('I need any text including a valid emoji'),
  stringUrl: z.string().url().describe('I need any text including a valid url'),
  stringUuid: z.string().uuid().describe('I need any text including a valid uuid'),
  stringCuid: z.string().cuid().describe('I need any text including a valid cuid'),
  stringRegex: z
    .string()
    .regex(/^test-/)
    .describe('I need any text including a valid regex'),

  // Number types
  number: z.number().describe('I need any number'),
  numberGt: z.number().gt(3).describe('I need any number greater than 3'),
  numberLt: z.number().lt(6).describe('I need any number less than 6'),
  numberGte: z.number().gte(1).describe('I need any number greater than or equal to 1'),
  numberLte: z.number().lte(1).describe('I need any number less than or equal to 1'),
  numberMultipleOf: z.number().multipleOf(2).describe('I need any number that is a multiple of 2'),
  numberInt: z.number().int().describe('I need any number that is an integer'),

  // Array types
  array: z.array(z.string()).describe('I need any array of strings'),
  arrayMin: z.array(z.string()).min(1).describe('I need any array of strings with a minimum of 1 string'),
  arrayMax: z.array(z.string()).max(5).describe('I need any array of strings with a maximum of 5 strings'),

  // Object types
  object: z.object({ foo: z.string(), bar: z.number() }).describe('I need any object with a string and a number'),
  objectNested: z
    .object({
      user: z.object({
        name: z.string().min(2),
        age: z.number().gte(18),
      }),
    })
    .describe('I need you to include a name and an age in your response'),
  objectPassthrough: z.object({}).passthrough().describe('Tell me about Toronto in two sentences'),

  // Optional and nullable
  optional: z.string().optional().describe('I need any text that is optional'),
  nullable: z.string().nullable().describe('I need any text that is nullable'),

  // Enums
  enum: z.enum(['A', 'B', 'C']).describe('I need you to pick a letter from A, B, or C'),
  nativeEnum: z.nativeEnum(TestEnum).describe('I need you to pick a letter from A, B, or C'),

  // Union types
  unionPrimitives: z.union([z.string(), z.number()]).describe('I need any text or number'),
  unionObjects: z
    .union([
      z.object({ amount: z.number(), inventoryItemName: z.string() }),
      z.object({ type: z.string(), permissions: z.array(z.string()) }),
    ])
    .describe(
      'Pretend to be a store clerk and tell me about an item in the store and how much you have of it. Also tell me about types of permissions you allow for your employees and their names.',
    ),

  // Default values
  default: z.string().default('test').describe('I need any text that is the default value'),

  // Uncategorized types, not supported by OpenAI reasoning models
  anyOptional: z.any().optional().describe('I need any text that is optional'),
  any: z.any().describe('I need any text'),
  intersection: z
    .intersection(z.string().min(1), z.string().max(4))
    .describe('I need any text that is between 1 and 4 characters'),
  never: z.never().describe('I need any text that is never'),
  null: z.null().describe('I need any text that is null'),
  tuple: z.tuple([z.string(), z.number(), z.boolean()]).describe('I need any text, number, and boolean'),
  undefined: z.undefined().describe('I need any text that is undefined'),
} as const;

const uncategorizedTypes = ['anyOptional', 'any', 'intersection', 'never', 'null', 'tuple', 'undefined'];

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
  schemaName: string,
): Promise<Result> {
  try {
    const openAIProviderOptions = {
      openai: {
        reasoningEffort: 'low',
      },
    };

    const agent = new Agent({
      name: `test-agent-${model.modelId}`,
      instructions: `I am testing that I can generate structured outputs from your response. Your sole purpose is to give me any type of response but make sure that you have the requested input somewhere in there.`,
      model: model,
    });

    const generateOptions: any = {
      maxSteps: 1,
      structuredOutput: {
        schema: testTool.inputSchema!,
        model: model,
        errorStrategy: 'strict',
      },
    };

    if (model.provider.includes('openai') || model.modelId.includes('openai')) {
      generateOptions.providerOptions = openAIProviderOptions;
    }

    const response = await agent.generate(allSchemas[schemaName].description, generateOptions);

    if (!response.object) {
      throw new Error('No object generated for schema: ' + schemaName + ' with text: ' + response.text);
    }

    const parsed = testTool.inputSchema?.parse(response.object);
    if (!parsed) {
      throw new Error('Failed to parse object for schema: ' + schemaName + ' with text: ' + response.text);
    }

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

// These tests are both expensive to run and occasionally a couple are flakey. We should run them manually for now
// to make sure that we still have good coverage, for both input and output schemas.
describe.skip('Tool Schema Compatibility', () => {
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
            if (
              (isGoogleModel(model) && (testTool.id.includes('unionObjects') || testTool.id.includes('null'))) ||
              // This works consistently locally but for some reason keeps failing in CI,
              model.modelId.includes('gpt-4o-mini') ||
              (model.modelId.includes('gemini-2.0-flash-lite-001') && testTool.id.includes('stringRegex'))
            ) {
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

    describe(`Output Schema Compatibility: ${provider} Models`, { timeout: SUITE_TIMEOUT }, () => {
      models.forEach(model => {
        describe(`${model.modelId}`, { timeout: SUITE_TIMEOUT }, () => {
          testTools.forEach(testTool => {
            const schemaName = testTool.id.replace('testTool_', '');

            // Google does not support unions of objects and is flakey withnulls
            if (
              (isGoogleModel(model) && (testTool.id.includes('unionObjects') || testTool.id.includes('null'))) ||
              // This works consistently locally but for some reason keeps failing in CI,
              model.modelId.includes('gpt-4o-mini') ||
              (model.modelId.includes('gemini-2.0-flash-lite-001') && testTool.id.includes('stringRegex'))
            ) {
              it.skip(`should handle ${schemaName} schema (skipped for ${provider})`, () => {});
              return;
            }
            if (uncategorizedTypes.includes(schemaName)) {
              it.skip(`should handle ${schemaName} schema (skipped for ${provider})`, () => {});
              return;
            }
            it.concurrent(
              `should handle ${schemaName} schema`,
              async () => {
                let result = await runSingleOutputsTest(model, testTool, crypto.randomUUID(), testTool.id, schemaName);

                // Sometimes models are flaky, run it again if it fails
                if (result.status === 'failure') {
                  console.log(`Possibly flake from model ${model.modelId}, running ${schemaName} again`);
                  result = await runSingleOutputsTest(model, testTool, crypto.randomUUID(), testTool.id, schemaName);
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

describe('CoreToolBuilder ID Preservation', () => {
  it('should preserve tool ID when building regular tools', () => {
    const originalTool = createTool({
      id: 'test-tool-id',
      description: 'A test tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ context }) => ({ result: context.value }),
    });

    const builder = new CoreToolBuilder({
      originalTool,
      options: {
        name: 'test-tool-id',
        logger: console as any,
        description: 'A test tool',
        runtimeContext: new RuntimeContext(),
        tracingContext: {},
      },
    });

    const builtTool = builder.build();

    expect(builtTool.id).toBe('test-tool-id');
  });

  it('should handle tools without ID gracefully', () => {
    // Create a tool-like object without an ID (like a VercelTool)
    const toolWithoutId = {
      description: 'A tool without ID',
      parameters: z.object({ value: z.string() }),
      execute: async (args: any) => ({ result: args.value }),
    };

    const builder = new CoreToolBuilder({
      originalTool: toolWithoutId as any,
      options: {
        name: 'tool-without-id',
        logger: console as any,
        description: 'A tool without ID',
        runtimeContext: new RuntimeContext(),
        tracingContext: {},
      },
    });

    const builtTool = builder.build();

    expect(builtTool.id).toBeUndefined();
  });

  it('should preserve provider-defined tool IDs correctly', () => {
    const providerTool = {
      type: 'provider-defined' as const,
      id: 'provider.tool-id',
      description: 'A provider-defined tool',
      parameters: z.object({ value: z.string() }),
      execute: async (args: any) => ({ result: args.value }),
    };

    const builder = new CoreToolBuilder({
      originalTool: providerTool as any,
      options: {
        name: 'provider.tool-id',
        logger: console as any,
        description: 'A provider-defined tool',
        runtimeContext: new RuntimeContext(),
        tracingContext: {},
      },
    });

    const builtTool = builder.build();

    expect(builtTool.id).toBe('provider.tool-id');
    expect(builtTool.type).toBe('provider-defined');
  });

  it('should verify tool ID exists in original createTool', () => {
    const tool = createTool({
      id: 'verify-id-exists',
      description: 'A test tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ context }) => ({ result: context.value }),
    });

    // Verify that the tool created with createTool() has an ID
    expect(tool.id).toBe('verify-id-exists');
  });
});

describe('Tool Tracing Context Injection', () => {
  it('should inject tracingContext for Mastra tools when agentAISpan is available', async () => {
    let receivedTracingContext: any = null;

    const testTool = createTool({
      id: 'tracing-test-tool',
      description: 'Test tool that captures tracing context',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ context, tracingContext }) => {
        receivedTracingContext = tracingContext;
        return { result: `processed: ${context.message}` };
      },
    });

    // Mock agent span
    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnyAISpan;

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'tracing-test-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'Test tool that captures tracing context',
        runtimeContext: new RuntimeContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();

    const result = await builtTool.execute!({ message: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tool span was created
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: AISpanType.TOOL_CALL,
      name: 'tool: tracing-test-tool',
      input: { message: 'test' },
      attributes: {
        toolId: 'tracing-test-tool',
        toolDescription: 'Test tool that captures tracing context',
        toolType: 'tool',
      },
    });

    // Verify tracingContext was injected with the tool span
    expect(receivedTracingContext).toBeTruthy();
    expect(receivedTracingContext.currentSpan).toBe(mockToolSpan);

    // Verify tool span was ended with result
    expect(mockToolSpan.end).toHaveBeenCalledWith({ output: { result: 'processed: test' } });
    expect(result).toEqual({ result: 'processed: test' });
  });

  it('should not inject tracingContext when agentAISpan is not available', async () => {
    let receivedTracingContext: any = undefined;

    const testTool = createTool({
      id: 'no-tracing-tool',
      description: 'Test tool without agent span',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ context, tracingContext }) => {
        receivedTracingContext = tracingContext;
        return { result: `processed: ${context.message}` };
      },
    });

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'no-tracing-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'Test tool without agent span',
        runtimeContext: new RuntimeContext(),
        tracingContext: {},
      },
    });

    const builtTool = builder.build();
    const result = await builtTool.execute!({ message: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tracingContext was injected but currentSpan is undefined
    expect(receivedTracingContext).toEqual({ currentSpan: undefined });
    expect(result).toEqual({ result: 'processed: test' });
  });

  it('should handle Vercel tools with tracing but not inject tracingContext', async () => {
    let executeCalled = false;

    // Mock Vercel tool
    const vercelTool = {
      description: 'Vercel tool test',
      parameters: z.object({ input: z.string() }),
      execute: async (args: unknown) => {
        executeCalled = true;
        return { output: `vercel result: ${(args as any).input}` };
      },
    };

    // Mock agent span
    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnyAISpan;

    const builder = new CoreToolBuilder({
      originalTool: vercelTool as any,
      options: {
        name: 'vercel-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'Vercel tool test',
        runtimeContext: new RuntimeContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();
    const result = await builtTool.execute!({ input: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tool span was created for Vercel tool
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: AISpanType.TOOL_CALL,
      name: 'tool: vercel-tool',
      input: { input: 'test' },
      attributes: {
        toolId: 'vercel-tool',
        toolDescription: 'Vercel tool test',
        toolType: 'tool',
      },
    });

    // Verify Vercel tool execute was called (without tracingContext)
    expect(executeCalled).toBe(true);

    // Verify tool span was ended with result
    expect(mockToolSpan.end).toHaveBeenCalledWith({ output: { output: 'vercel result: test' } });
    expect(result).toEqual({ output: 'vercel result: test' });
  });

  it('should handle tool execution errors and end span with error', async () => {
    const testError = new Error('Tool execution failed');

    const testTool = createTool({
      id: 'error-tool',
      description: 'Tool that throws an error',
      inputSchema: z.object({ message: z.string() }),
      execute: async () => {
        throw testError;
      },
    });

    // Mock agent span
    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnyAISpan;

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'error-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'Tool that throws an error',
        runtimeContext: new RuntimeContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();

    // Execute the tool - it should return a MastraError instead of throwing
    const result = await builtTool.execute!({ message: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tool span was created
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalled();

    // Verify tool span was ended with error
    expect(mockToolSpan.error).toHaveBeenCalledWith({ error: testError });
    expect(mockToolSpan.end).not.toHaveBeenCalled(); // Should not call end() when error() is called

    // Verify the result is a MastraError
    expect(result).toHaveProperty('id', 'TOOL_EXECUTION_FAILED');
    expect(result).toHaveProperty('message', 'Tool execution failed');
  });

  it('should create child span with correct logType attribute', async () => {
    const testTool = createTool({
      id: 'toolset-tool',
      description: 'Tool from a toolset',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ context }) => ({ result: context.message }),
    });

    // Mock agent span
    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnyAISpan;

    const builder = new CoreToolBuilder({
      originalTool: testTool,
      options: {
        name: 'toolset-tool',
        logger: {
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          trackException: vi.fn(),
        } as any,
        description: 'Tool from a toolset',
        runtimeContext: new RuntimeContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
      logType: 'toolset', // Specify toolset type
    });

    const builtTool = builder.build();
    await builtTool.execute!({ message: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tool span was created with correct toolType attribute
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: AISpanType.TOOL_CALL,
      name: 'tool: toolset-tool',
      input: { message: 'test' },
      attributes: {
        toolId: 'toolset-tool',
        toolDescription: 'Tool from a toolset',
        toolType: 'toolset',
      },
    });
  });
});

describe('Tool Input Validation', () => {
  const toolWithValidation = createTool({
    id: 'validationTool',
    description: 'Tool that validates input parameters',
    inputSchema: z.object({
      name: z.string().min(3, 'Name must be at least 3 characters'),
      age: z.number().min(0, 'Age must be positive').max(150, 'Age must be less than 150'),
      email: z.string().email('Invalid email format').optional(),
      tags: z.array(z.string()).min(1, 'At least one tag required').optional(),
    }),
    execute: async ({ context }) => {
      return {
        message: `Hello ${context.name}, you are ${context.age} years old`,
        email: context.email,
        tags: context.tags,
      };
    },
  });

  it('should execute successfully with valid inputs', async () => {
    const result = await toolWithValidation.execute!({
      context: {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['developer', 'typescript'],
      },
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    expect(result).toEqual({
      message: 'Hello John Doe, you are 30 years old',
      email: 'john@example.com',
      tags: ['developer', 'typescript'],
    });
  });

  it('should execute successfully with only required fields', async () => {
    const result = await toolWithValidation.execute!({
      context: {
        name: 'Jane',
        age: 25,
      },
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    expect(result).toEqual({
      message: 'Hello Jane, you are 25 years old',
      email: undefined,
      tags: undefined,
    });
  });

  it('should return validation error for short name', async () => {
    // With graceful error handling, validation errors are returned as results
    const result: any = await toolWithValidation.execute!({
      context: {
        name: 'Jo', // Too short
        age: 30,
      },
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('Tool validation failed');
    expect(result.message).toContain('Name must be at least 3 characters');
    expect(result.message).toContain('- name:');
  });

  it('should return validation error for negative age', async () => {
    // With graceful error handling, validation errors are returned as results
    const result: any = await toolWithValidation.execute!({
      context: {
        name: 'John',
        age: -5, // Negative age
      },
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('Tool validation failed');
    expect(result.message).toContain('Age must be positive');
    expect(result.message).toContain('- age:');
  });

  it('should return validation error for invalid email', async () => {
    // With graceful error handling, validation errors are returned as results
    const result: any = await toolWithValidation.execute!({
      context: {
        name: 'John',
        age: 30,
        email: 'not-an-email', // Invalid email
      },
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('Tool validation failed');
    expect(result.message).toContain('Invalid email format');
    expect(result.message).toContain('- email:');
  });

  it('should return validation error for missing required fields', async () => {
    // With graceful error handling, validation errors are returned as results
    const result: any = await toolWithValidation.execute!({
      // @ts-expect-error intentionally incorrect input
      context: {
        // Missing name
        age: 30,
      },
      runtimeContext: new RuntimeContext(),
    });

    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('Tool validation failed');
    expect(result.message).toContain('Required');
    expect(result.message).toContain('- name:');
  });

  it('should return validation error for empty tags array when provided', async () => {
    // With graceful error handling, validation errors are returned as results
    const result: any = await toolWithValidation.execute!({
      context: {
        name: 'John',
        age: 30,
        tags: [], // Empty array when min(1) required
      },
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('Tool validation failed');
    expect(result.message).toContain('At least one tag required');
    expect(result.message).toContain('- tags:');
  });

  it('should show provided arguments in validation error message', async () => {
    // Test that the error message includes the problematic arguments
    const result: any = await toolWithValidation.execute!({
      context: {
        name: 'A', // Too short
        age: 200, // Too old
        email: 'bad-email',
        tags: [],
      },
      runtimeContext: new RuntimeContext(),
      tracingContext: {},
    });

    expect(result).toHaveProperty('error', true);
    expect(result.message).toContain('Provided arguments:');
    expect(result.message).toContain('"name": "A"');
    expect(result.message).toContain('"age": 200');
    expect(result.message).toContain('"email": "bad-email"');
    expect(result.message).toContain('"tags": []');
  });
});
