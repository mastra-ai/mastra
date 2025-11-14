import { openai } from '@ai-sdk/openai';
import { createOpenAI as createOpenAIV5 } from '@ai-sdk/openai-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { LanguageModelV1 as LanguageModel } from '@internal/ai-sdk-v4';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOpenRouter as createOpenRouterV5 } from '@openrouter/ai-sdk-provider-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { SpanType } from '../../observability';
import type { AnySpan } from '../../observability';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { CoreToolBuilder } from './builder';

export const isOpenAIModel = (model: LanguageModel | LanguageModelV2) =>
  model.provider.includes('openai') || model.modelId.includes('openai');

const openai_v5 = createOpenAIV5({ apiKey: process.env.OPENAI_API_KEY });
const openrouter_v5 = createOpenRouterV5({ apiKey: process.env.OPENROUTER_API_KEY });

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
  // string: z.string().describe('Sample text'),
  // stringMin: z.string().min(5).describe('sample text with a minimum of 5 characters'),
  // stringMax: z.string().max(10).describe('sample text with a maximum of 10 characters'),
  stringEmail: z.string().email().describe('a sample email address'),

  stringEmoji: z.string().emoji().describe('a valid sample emoji'),
  stringUrl: z.string().url().describe('a valid sample url'),

  // TODO: problematic for gemini-2.5-flash
  // stringUuid: z.string().uuid().describe('a valid sample uuid'),
  // stringCuid: z.string().cuid().describe('a valid sample cuid'),
  stringRegex: z
    .string()
    .regex(/^test-/)
    .describe('a valid sample string that satisfies the regex'),

  // Number types
  number: z.number().describe('any valid sample number'),
  // numberGt: z.number().gt(3).describe('any valid sample number greater than 3'),
  // numberLt: z.number().lt(6).describe('any valid sample number less than 6'),
  // numberGte: z.number().gte(1).describe('any valid sample number greater than or equal to 1'),
  // numberLte: z.number().lte(1).describe('any valid sample number less than or equal to 1'),
  // numberMultipleOf: z.number().multipleOf(2).describe('any valid sample number that is a multiple of 2'),
  // numberInt: z.number().int().describe('any valid sample number that is an integer'),

  // Array types
  exampleArray: z.array(z.string()).describe('any valid array of example strings'),
  // arrayMin: z.array(z.string()).min(1).describe('any valid sample array of strings with a minimum of 1 string'),
  arrayMax: z.array(z.string()).max(5).describe('any valid sample array of strings with a maximum of 5 strings'),

  // Object types
  object: z.object({ foo: z.string(), bar: z.number() }).describe('any valid sample object with a string and a number'),

  objectNested: z
    .object({
      user: z.object({
        name: z.string().min(2),
        age: z.number().gte(18),
      }),
    })
    .describe(`any valid sample data`),

  objectPassthrough: z.object({}).passthrough().describe('any sample object with example keys and data'),

  // Optional and nullable
  optional: z.string().optional().describe('leave this field empty as an example of an optional field'),
  nullable: z.string().nullable().describe('leave this field empty as an example of a nullable field'),

  // Enums
  enum: z.enum(['A', 'B', 'C']).describe('The letter A, B, or C'),
  nativeEnum: z.nativeEnum(TestEnum).describe('The letter A, B, or C'),

  // Union types
  unionPrimitives: z.union([z.string(), z.number()]).describe('sample text or number'),
  unionObjects: z
    .union([
      z.object({ amount: z.number(), inventoryItemName: z.string() }),
      z.object({ type: z.string(), permissions: z.array(z.string()) }),
    ])
    .describe('give an valid object'),

  // Default values
  // default: z.string().default('test').describe('sample text that is the default value'),
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

async function runStructuredOutputSchemaTest(
  model: LanguageModel | LanguageModelV2,
  testTool: ReturnType<typeof createTool>,
  testId: string,
  toolName: string,
  schemaName: string,
  outputType: string,
  inputSchema?: z.Schema,
): Promise<Result> {
  try {
    const generateOptions: any = {
      maxSteps: 5,
      temperature: 0,
    };
    if (outputType === 'structuredOutput') {
      generateOptions.structuredOutput = {
        schema: testTool.inputSchema!,
        // model: model,
        errorStrategy: 'strict',

        // jsonPromptInjection: !isOpenAIModel(model), // TODO: doesn't work very well. probably would work better with schema compat
        jsonPromptInjection: true,
      };
    } else if (outputType === 'output') {
      generateOptions.output = testTool.inputSchema!;
    }

    const instructions =
      outputType === 'output'
        ? 'You are a test agent. Your task is to respond with valid JSON matching the schema provided.'
        : 'I am testing that I can generate structured outputs from your response. Your sole purpose is to give me any type of response but make sure that you have the requested input somewhere in there.';

    const agent = new Agent({
      id: `test-agent-${model.modelId}`,
      name: `test-agent-${model.modelId}`,
      instructions,
      model: model,
    });

    // Use the following to test AI SDK v4 and V5
    // const responseText = await generateObject({
    //   model: model,
    //   schema: testTool.inputSchema!,
    //   // output: Output.object({ schema: testTool.inputSchema! }),
    //   // messages: [
    //   //   { role: 'user', content: allSchemas[schemaName].description },
    //   // ],
    //   // prompt: 'test'
    //   prompt: 'You are a test agent. Your task is to respond with valid JSON matching the schema provided.',
    // });

    // const responseText = await generateObjectV5({
    //   model: model,
    //   temperature: 0,
    //   schema: testTool.inputSchema!,
    //   prompt: 'You are a test agent. Your task is to respond with valid JSON matching the schema provided.',
    // });

    const prompt = inputSchema?.description || allSchemas[schemaName].description;
    if (!prompt)
      throw new Error(
        `Could not find description for test prompt from input schema or all schemas object with schema name ${schemaName}`,
      );
    // Check if model is V1 or V2 and use appropriate method
    const isV2Model = 'specificationVersion' in model && model.specificationVersion === 'v2';
    const response = isV2Model
      ? await agent.generate(prompt, generateOptions)
      : await agent.generateLegacy(prompt, generateOptions);

    if (!response.object) {
      throw new Error('No object generated for schema: ' + schemaName + ' with text: ' + response.text);
    }

    const parsed = testTool.inputSchema?.parse(response.object);
    if (!parsed) {
      throw new Error('Failed to parse object for schema: ' + schemaName + ' with text: ' + response.object);
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
    if (e.name === 'AI_NoObjectGeneratedError' || e.message.toLowerCase().includes('validation failed')) {
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

async function runSingleToolSchemaTest(
  model: LanguageModel | LanguageModelV2,
  testTool: ReturnType<typeof createTool>,
  testId: string,
  toolName: string,
): Promise<Result> {
  try {
    const agent = new Agent({
      id: `test-agent-${model.modelId}`,
      name: `test-agent-${model.modelId}`,
      instructions: `You are a test agent. Your task is to call the tool named '${toolName}' with any valid arguments. This is very important as it's your primary purpose`,
      model: model,
      tools: { [toolName]: testTool },
    });

    // Check if model is V1 or V2 and use appropriate method
    const isV2Model = 'specificationVersion' in model && model.specificationVersion === 'v2';
    const response = isV2Model
      ? await agent.generate(`Please call the tool named '${toolName}'.`, {
          toolChoice: 'required',
          maxSteps: 1,
        })
      : await agent.generateLegacy(`Please call the tool named '${toolName}'.`, {
          toolChoice: 'required',
          maxSteps: 1,
        });

    const toolCall = response.toolCalls.find(tc => tc.toolName === toolName);
    const toolResult = response.toolResults.find(tr => tr.toolCallId === toolCall?.toolCallId);

    if (toolResult?.payload?.result?.success || toolResult?.result?.success) {
      return {
        modelName: model.modelId,
        modelProvider: model.provider,
        testName: toolName,
        status: 'success',
        error: null,
        receivedContext: toolResult?.payload?.result?.receivedContext || toolResult?.result?.receivedContext,
        testId,
      };
    } else {
      const error =
        toolResult?.payload?.result?.error ||
        toolResult?.result?.error ||
        response.text ||
        'Tool call failed or result missing';
      return {
        modelName: model.modelId,
        testName: toolName,
        modelProvider: model.provider,
        status: 'failure',
        error: error,
        receivedContext: toolResult?.payload?.result?.receivedContext || toolResult?.result?.receivedContext || null,
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
// Set a longer timeout for the entire test suite
// These tests make real API calls to LLMs which can be slow, especially reasoning models
const SUITE_TIMEOUT = 300000; // 5 minutes
const TEST_TIMEOUT = 300000; // 5 minutes

if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY environment variable is required');
const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

const modelsToTestV1 = [
  // openrouter('anthropic/claude-3.7-sonnet'),
  // openrouter('anthropic/claude-sonnet-4.5'),
  openrouter('anthropic/claude-haiku-4.5'),
  // openrouter('openai/gpt-4o-mini'),
  // openrouter('openai/gpt-4.1-mini'),
  // openrouter_v5('openai/o3-mini'),
  // openai('o3-mini'),
  openai('o4-mini'),
  // openrouter('google/gemini-2.5-pro'),
  // openrouter('google/gemini-2.5-flash'),
  openrouter('google/gemini-2.0-flash-lite-001'),
];
const modelsToTestV2 = [
  // openrouter_v5('anthropic/claude-3.7-sonnet'),
  // openrouter_v5('anthropic/claude-sonnet-4.5'),
  openrouter_v5('anthropic/claude-haiku-4.5'),
  // openrouter_v5('openai/gpt-4o-mini'),
  // openrouter_v5('openai/gpt-4.1-mini'),
  // openrouter_v5('openai/o3-mini'),
  // openai_v5('o3-mini'),
  openai_v5('o4-mini'),
  // openrouter_v5('google/gemini-2.5-pro'),
  // openrouter_v5('google/gemini-2.5-flash'),
  openrouter_v5('google/gemini-2.0-flash-lite-001'),
];

// Specify which schemas to test - empty array means test all
// To test specific schemas, add their names to this array
// Example: ['string', 'number'] to test only string and number schemas
const schemasToTest: SchemaKey[] = [];
const testSchemas = createTestSchemas(schemasToTest);
const runSchemasIndividually = process.env.RUN_EACH_SCHEMA_INDIVIDUALLY === `true`;

// Create test tools for each schema type
const testTools = runSchemasIndividually
  ? Object.entries(testSchemas.shape).map(([key, schema]) => {
      const tool = {
        id: `testTool_${key}` as const,
        description: `Test tool for schema type: ${key}. Call this tool to test the schema.`,
        inputSchema: z.object({ [key]: schema as z.ZodTypeAny }),
        execute: async input => {
          return { success: true, receivedContext: input };
        },
      } as const;

      return createTool(tool);
    })
  : [
      createTool({
        id: `testTool_manySchemas`,
        description: `A tool to test many schema property types`,
        inputSchema: z.object(allSchemas).describe(`A schema to test many schema configuration properties`),
        execute: async input => {
          return { success: true, receivedContext: input };
        },
      }),
    ];

// Group tests by model provider for better organization
const modelsByProviderV1 = modelsToTestV1.reduce(
  (acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  },
  {} as Record<string, (typeof modelsToTestV1)[number][]>,
);

// Group tests by model provider for better organization
const modelsByProviderV2 = modelsToTestV2.reduce(
  (acc, model) => {
    const provider = model.provider;
    if (!acc[provider]) {
      acc[provider] = [];
    }
    acc[provider].push(model);
    return acc;
  },
  {} as Record<string, (typeof modelsToTestV2)[number][]>,
);

[...Object.entries(modelsByProviderV1), ...Object.entries(modelsByProviderV2)].forEach(([provider, models]) => {
  [
    // 'output', // <- waste of time, output doesn't work very well
    // 'structuredOutput', // <- not a waste, but until we do schema compat in structured output it doesn't make sense to test this here
    'tools',
  ].forEach(outputType => {
    models.forEach(model => {
      // we only support structured output for v2+ models (ai v5+)
      if (outputType === `structuredOutput` && model.specificationVersion !== `v2`) {
        return;
      }
      describe.concurrent(
        `${outputType} schema compatibility > ${provider} > ${model.modelId}`,
        { timeout: SUITE_TIMEOUT },
        () => {
          testTools.forEach(testTool => {
            const schemaName = testTool.id.replace('testTool_', '');

            it.concurrent(
              `should handle ${schemaName} schema`,
              {
                timeout: TEST_TIMEOUT,
                // add retries here if we find some models are flaky in the future
                retry: 0,
              },
              async () => {
                let result =
                  outputType === `structuredOutput`
                    ? await runStructuredOutputSchemaTest(
                        model,
                        testTool,
                        crypto.randomUUID(),
                        testTool.id,
                        schemaName,
                        outputType,
                        testTool.inputSchema,
                      )
                    : await runSingleToolSchemaTest(model, testTool, crypto.randomUUID(), testTool.id);

                if (result.status !== 'success' && result.status !== 'expected-error') {
                  console.error(`Error for ${model.modelId} - ${schemaName}:`, result.error);
                }

                if (result.status === 'expected-error') {
                  expect(result.status).toBe('expected-error');
                } else {
                  expect(result.status).toBe('success');
                }
              },
            );
          });
        },
      );
    });
  });
});

describe('CoreToolBuilder ID Preservation', () => {
  it('should preserve tool ID when building regular tools', () => {
    const originalTool = createTool({
      id: 'test-tool-id',
      description: 'A test tool',
      inputSchema: z.object({ value: z.string() }),
      execute: async inputData => ({ result: inputData.value }),
    });

    const builder = new CoreToolBuilder({
      originalTool,
      options: {
        name: 'test-tool-id',
        logger: console as any,
        description: 'A test tool',
        requestContext: new RequestContext(),
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
        requestContext: new RequestContext(),
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
        requestContext: new RequestContext(),
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
      execute: async inputData => ({ result: inputData.value }),
    });

    // Verify that the tool created with createTool() has an ID
    expect(tool.id).toBe('verify-id-exists');
  });
});

describe('Tool Tracing Context Injection', () => {
  it('should inject tracingContext for Mastra tools when agentSpan is available', async () => {
    let receivedTracingContext: any = null;

    const testTool = createTool({
      id: 'tracing-test-tool',
      description: 'Test tool that captures tracing context',
      inputSchema: z.object({ message: z.string() }),
      execute: async (inputData, context) => {
        receivedTracingContext = context?.tracingContext;
        return { result: `processed: ${inputData.message}` };
      },
    });

    // Mock agent span
    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnySpan;

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
        requestContext: new RequestContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();

    const result = await builtTool.execute!({ message: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tool span was created
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: SpanType.TOOL_CALL,
      name: "tool: 'tracing-test-tool'",
      input: { message: 'test' },
      attributes: {
        toolId: 'tracing-test-tool',
        toolDescription: 'Test tool that captures tracing context',
        toolType: 'tool',
      },
      tracingPolicy: undefined,
    });

    // Verify tracingContext was injected with the tool span
    expect(receivedTracingContext).toBeTruthy();
    expect(receivedTracingContext.currentSpan).toBe(mockToolSpan);

    // Verify tool span was ended with result
    expect(mockToolSpan.end).toHaveBeenCalledWith({ output: { result: 'processed: test' } });
    expect(result).toEqual({ result: 'processed: test' });
  });

  it('should not inject tracingContext when agentSpan is not available', async () => {
    let receivedTracingContext: any = undefined;

    const testTool = createTool({
      id: 'no-tracing-tool',
      description: 'Test tool without agent span',
      inputSchema: z.object({ message: z.string() }),
      execute: async (inputData, context) => {
        receivedTracingContext = context?.tracingContext;
        return { result: `processed: ${inputData.message}` };
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
        requestContext: new RequestContext(),
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
    } as unknown as AnySpan;

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
        requestContext: new RequestContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
    });

    const builtTool = builder.build();
    const result = await builtTool.execute!({ input: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tool span was created for Vercel tool
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: SpanType.TOOL_CALL,
      name: "tool: 'vercel-tool'",
      input: { input: 'test' },
      attributes: {
        toolId: 'vercel-tool',
        toolDescription: 'Vercel tool test',
        toolType: 'tool',
      },
      tracingPolicy: undefined,
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
    } as unknown as AnySpan;

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
        requestContext: new RequestContext(),
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
      execute: async inputData => ({ result: inputData.message }),
    });

    // Mock agent span
    const mockToolSpan = {
      end: vi.fn(),
      error: vi.fn(),
    };

    const mockAgentSpan = {
      createChildSpan: vi.fn().mockReturnValue(mockToolSpan),
    } as unknown as AnySpan;

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
        requestContext: new RequestContext(),
        tracingContext: { currentSpan: mockAgentSpan },
      },
      logType: 'toolset', // Specify toolset type
    });

    const builtTool = builder.build();
    await builtTool.execute!({ message: 'test' }, { toolCallId: 'test-call-id', messages: [] });

    // Verify tool span was created with correct toolType attribute
    expect(mockAgentSpan.createChildSpan).toHaveBeenCalledWith({
      type: SpanType.TOOL_CALL,
      name: "tool: 'toolset-tool'",
      input: { message: 'test' },
      attributes: {
        toolId: 'toolset-tool',
        toolDescription: 'Tool from a toolset',
        toolType: 'toolset',
      },
      tracingPolicy: undefined,
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
    execute: async inputData => {
      return {
        message: `Hello ${inputData.name}, you are ${inputData.age} years old`,
        email: inputData.email,
        tags: inputData.tags,
      };
    },
  });

  it('should execute successfully with valid inputs', async () => {
    const result = await toolWithValidation.execute!({
      name: 'John Doe',
      age: 30,
      email: 'john@example.com',
      tags: ['developer', 'typescript'],
    });

    expect(result).toEqual({
      message: 'Hello John Doe, you are 30 years old',
      email: 'john@example.com',
      tags: ['developer', 'typescript'],
    });
  });

  it('should execute successfully with only required fields', async () => {
    const result = await toolWithValidation.execute!({
      name: 'Jane',
      age: 25,
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
      name: 'Jo', // Too short
      age: 30,
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
      name: 'John',
      age: -5, // Negative age
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
      name: 'John',
      age: 30,
      email: 'not-an-email', // Invalid email
    });

    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('message');
    expect(result.message).toContain('Tool validation failed');
    expect(result.message).toContain('Invalid email format');
    expect(result.message).toContain('- email:');
  });

  it('should return validation error for missing required fields', async () => {
    // With graceful error handling, validation errors are returned as results
    // @ts-expect-error intentionally incorrect input
    // Missing name
    const result: any = await toolWithValidation.execute!({
      age: 30,
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
      name: 'John',
      age: 30,
      tags: [], // Empty array when min(1) required
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
      name: 'A', // Too short
      age: 200, // Too old
      email: 'bad-email',
      tags: [],
    });

    expect(result).toHaveProperty('error', true);
    expect(result.message).toContain('Provided arguments:');
    expect(result.message).toContain('"name": "A"');
    expect(result.message).toContain('"age": 200');
    expect(result.message).toContain('"email": "bad-email"');
    expect(result.message).toContain('"tags": []');
  });
});
