import { AnthropicSchemaCompatLayer, isStandardSchemaWithJSON, toStandardSchema } from '@mastra/schema-compat';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { createTool } from '../tool';
import type { ToolAction } from '../types';
import { validateToolInput } from '../validation';
import { CoreToolBuilder } from './builder';

const haikuModelConfig = {
  provider: 'anthropic',
  modelId: 'claude-3.5-haiku-20241022',
  specificationVersion: 'v4' as const,
  supportsStructuredOutputs: false,
} as const;

function buildCoreTool(
  tool: ToolAction<any, any>,
  name: string,
  model: typeof haikuModelConfig | Record<string, unknown>,
) {
  return new CoreToolBuilder({
    originalTool: tool,
    options: {
      name,
      model: model as any,
      requestContext: new RequestContext(),
    },
  }).build();
}

describe('CoreToolBuilder - Schema Compatibility in Validation', () => {
  it('createTool execute path skips author-schema re-validation after CoreToolBuilder compat validation', async () => {
    // createTool wraps execute with author-schema validation; CoreToolBuilder must use executeWithPrevalidatedInput.
    const execute = vi.fn(async ({ text }: { text: string }) => ({ success: true, text }));
    const shortTextTool = createTool({
      id: 'short-text-tool',
      description: 'Tool created via createTool',
      inputSchema: z.object({
        text: z.string().min(20),
      }),
      execute,
    });

    const coreTool = buildCoreTool(shortTextTool, 'shortTextTool', haikuModelConfig);
    const executeResult = await coreTool.execute?.(
      { text: 'Short text' },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'call-create-tool',
        messages: [],
      },
    );

    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({ success: true, text: 'Short text' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('prefers processZodType over processToCompatSchema for Zod v4 (regression guard)', () => {
    const inputSchema = z.object({ text: z.string().min(20) });
    expect(isStandardSchemaWithJSON(inputSchema)).toBe(true);

    const layer = new AnthropicSchemaCompatLayer(haikuModelConfig as any);
    const shortInput = { text: 'Short text' };

    const viaCompatSchema = toStandardSchema(layer.processToCompatSchema(inputSchema));
    expect(validateToolInput(viaCompatSchema, shortInput, 'regression').error).toBeDefined();

    const viaZodType = toStandardSchema(layer.processZodType(inputSchema));
    expect(validateToolInput(viaZodType, shortInput, 'regression').error).toBeUndefined();
  });

  it('strips string minLength from LLM-facing parameters and execute validation on Haiku', async () => {
    const inputSchema = z.object({
      message: z.string().min(10).describe('A message with minimum 10 characters'),
    });

    const tool: ToolAction<any, any> = {
      id: 'test-tool',
      description: 'A test tool with string constraints',
      inputSchema,
      execute: async ({ message }) => ({ result: `Received: ${message}` }),
    };

    const coreTool = buildCoreTool(tool, 'test-tool', haikuModelConfig);
    const llmJsonSchema = (coreTool.parameters as { jsonSchema?: { properties?: Record<string, unknown> } }).jsonSchema;
    const messageProp = llmJsonSchema?.properties?.message as { minLength?: number } | undefined;

    expect(messageProp?.minLength).toBeUndefined();

    const executeResult = await coreTool.execute?.(
      { message: 'Hi there' },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({ result: 'Received: Hi there' });
  });

  it('still rejects invalid tool input on Haiku after compat transformation', async () => {
    const inputSchema = z.object({
      message: z.string().min(10),
    });

    const tool: ToolAction<any, any> = {
      id: 'test-tool',
      description: 'Reject invalid shapes',
      inputSchema,
      execute: async ({ message }) => ({ message }),
    };

    const coreTool = buildCoreTool(tool, 'test-tool', haikuModelConfig);

    const wrongType = await coreTool.execute?.(
      { message: 123 },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );
    expect(wrongType).toHaveProperty('error', true);

    const missingField = await coreTool.execute?.(
      {},
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );
    expect(missingField).toHaveProperty('error', true);
  });

  it('preserves original constraints when no schema compat layer applies', async () => {
    const inputSchema = z.object({
      message: z.string().min(10),
    });

    const tool: ToolAction<any, any> = {
      id: 'test-tool',
      description: 'No compat layers',
      inputSchema,
      execute: async ({ message }) => ({ message }),
    };

    const coreTool = buildCoreTool(tool, 'test-tool', {
      provider: 'local',
      modelId: 'local-test-model',
      specificationVersion: 'v4',
      supportsStructuredOutputs: false,
    });

    const executeResult = await coreTool.execute?.(
      { message: 'short' },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    expect(executeResult).toHaveProperty('error', true);
    expect((executeResult as { message?: string }).message).toMatch(/validation failed/i);
  });

  it('should use schema-compat transformed schema for BOTH LLM parameters AND validation', async () => {
    // Create a tool with string min constraint
    const inputSchema = z.object({
      message: z.string().min(10).describe('A message with minimum 10 characters'),
    });

    const toolWithConstraints: ToolAction<any, any> = {
      id: 'test-tool',
      description: 'A test tool with string constraints',
      inputSchema,
      execute: async (input: z.infer<typeof inputSchema>) => {
        const { message } = input;
        return { result: `Received: ${message}` };
      },
    };

    // Create a model config that requires schema transformation (Claude 3.5 Haiku strips min/max from strings)
    const modelConfig = haikuModelConfig;

    const coreTool = new CoreToolBuilder({
      originalTool: toolWithConstraints,
      options: {
        name: 'test-tool',
        model: modelConfig as any,
        requestContext: new RequestContext(),
      },
    }).build();

    // ASSERTION 1: The parameters sent to the LLM should be transformed
    // (Claude 3.5 Haiku compatibility layer removes min/max constraints from strings)
    const anthropicLayer = new AnthropicSchemaCompatLayer(modelConfig as any);

    // The original schema has a min constraint
    const originalSchema = inputSchema;
    const messageField = originalSchema.shape.message as z.ZodString;
    // Zod v4 uses class instances for checks instead of plain objects
    // Check by looking for the MinLength check class
    const hasMinCheck =
      messageField._def.checks?.some(
        (check: any) =>
          check.constructor?.name === '$ZodCheckMinLength' || (check.kind === 'min' && check.value === 10),
      ) ?? false;
    expect(hasMinCheck).toBe(true);

    // The transformed schema should NOT have the min constraint (for Claude 3.5 Haiku)
    // This is what the LLM sees
    const transformedSchema = anthropicLayer.processZodType(originalSchema);
    const transformedMessageField = (transformedSchema as any).shape.message as z.ZodString;

    // Zod v4 uses class instances for checks instead of plain objects
    const hasMinCheckAfterTransform =
      transformedMessageField._def.checks?.some(
        (check: any) => check.constructor?.name === '$ZodCheckMinLength' || check.kind === 'min',
      ) ?? false;
    expect(hasMinCheckAfterTransform).toBe(false);

    // ASSERTION 2: Validation must use the same transformed schema the LLM saw

    // Simulate what happens when the LLM calls the tool with a short string (< 10 chars)
    // The LLM was told there's no minimum, so it might send a short string
    const shortMessage = 'Hi there'; // Only 8 characters, less than the original min of 10

    const executeResult = await coreTool.execute?.(
      { message: shortMessage },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toHaveProperty('result');
    expect(executeResult.result).toBe('Received: Hi there');
  });

  it('should validate against transformed schema for number constraints with Anthropic', async () => {
    // Create a tool with number constraints
    const inputSchema2 = z.object({
      age: z.number().min(18).max(100).describe('Age between 18 and 100'),
    });

    const toolWithNumberConstraints: ToolAction<any, any> = {
      id: 'number-tool',
      description: 'A test tool with number constraints',
      inputSchema: inputSchema2,
      execute: async (input: z.infer<typeof inputSchema2>) => {
        const { age } = input;
        return { result: `Age: ${age}` };
      },
    };

    const modelConfig = {
      provider: 'anthropic',
      modelId: 'claude-3-opus-20240229',
      specificationVersion: 'v2' as const,
      supportsStructuredOutputs: false,
    };

    const builder = new CoreToolBuilder({
      originalTool: toolWithNumberConstraints,
      options: {
        name: 'number-tool',
        model: modelConfig as any,
        requestContext: new RequestContext(),
      },
    });

    const coreTool = builder.build();

    // Anthropic's schema compat layer transforms number constraints
    // The LLM receives a schema without strict min/max enforcement

    const executeResult = await coreTool.execute?.(
      { age: 25 },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toHaveProperty('result');
  });

  it('validates short strings when Anthropic Haiku strips string min constraints from the LLM schema', async () => {
    const inputSchema4 = z.object({
      text: z.string().min(20).describe('Text with minimum 20 characters'),
    });

    const toolWithMinConstraint: ToolAction<any, any> = {
      id: 'bug-demo-tool',
      description: 'Demonstrates the validation bug',
      inputSchema: inputSchema4,
      execute: async (input: z.infer<typeof inputSchema4>) => {
        const { text } = input;
        return { success: true, text };
      },
    };

    const modelConfig = {
      provider: 'anthropic',
      modelId: 'claude-3.5-haiku-20241022',
      specificationVersion: 'v4' as const,
      supportsStructuredOutputs: false,
    };

    const builder = new CoreToolBuilder({
      originalTool: toolWithMinConstraint,
      options: {
        name: 'bug-demo-tool',
        model: modelConfig as any,
        requestContext: new RequestContext(),
      },
    });

    const coreTool = builder.build();

    // The LLM receives a schema WITHOUT the min(20) constraint
    // So it might send a string with only 10 characters
    const shortText = 'Short text'; // Only 10 characters

    const executeResult = await coreTool.execute?.(
      { text: shortText },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({
      success: true,
      text: shortText,
    });
  });

  it('should handle OpenAI o3 reasoning model converting optional to nullable (working memory bug)', async () => {
    // This reproduces the exact bug reported by the user with updateWorkingMemory tool
    // OpenAI o3 converts .optional() to .nullable(), then sends null, but validation
    // was checking against the original schema which expects string | undefined
    const inputSchema5 = z.object({
      newMemory: z.string().describe('New memory to add'),
      searchString: z.string().optional().describe('Optional search string'),
      updateReason: z.string().describe('Reason for update'),
    });

    const updateWorkingMemoryTool: ToolAction<any, any> = {
      id: 'updateWorkingMemory',
      description: 'Update working memory',
      inputSchema: inputSchema5,
      execute: async (input: z.infer<typeof inputSchema5>) => {
        const { newMemory, searchString, updateReason } = input;
        return { success: true, newMemory, searchString, updateReason };
      },
    };

    const modelConfig = {
      provider: 'openai',
      modelId: 'o3-mini',
      specificationVersion: 'v4' as const,
      supportsStructuredOutputs: true,
    };

    const builder = new CoreToolBuilder({
      originalTool: updateWorkingMemoryTool,
      options: {
        name: 'updateWorkingMemory',
        model: modelConfig as any,
        requestContext: new RequestContext(),
      },
    });

    const coreTool = builder.build();

    // OpenAI o3 converts .optional() to .nullable() via OpenAIReasoningSchemaCompatLayer
    // So the LLM sends null instead of undefined for optional fields
    const newMemoryValue = '#User\n- First Name: Randy\n- Last Name: Lynn';
    const executeResult = await coreTool.execute?.(
      {
        newMemory: newMemoryValue,
        searchString: null, // LLM sends null because schema was converted to nullable
        updateReason: 'append-new-memory',
      },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'call_W84bP8Lo2qCwIYe03QDLCgTJ',
        messages: [],
      },
    );

    // Compat validation coerces null back to undefined for optional fields
    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({
      success: true,
      newMemory: newMemoryValue,
      searchString: undefined,
      updateReason: 'append-new-memory',
    });
  });

  it.skip('should respect structured outputs for v2 models and preserve enums/constraints', async () => {
    const category = z.enum(['book', 'device']).describe('Inventory category');

    const inputSchema = z
      .object({
        category: category.optional().describe('Inventory category'),
        price: z.number().min(1).describe('Unit price'),
        label: z
          .string()
          .trim()
          .optional()
          .transform(v => v?.toLowerCase())
          .describe('Optional label'),
      })
      .describe('Inventory search filters');

    const toolWithEnum: ToolAction<any, any> = {
      id: 'v2-structured-tool',
      description: 'Tool with enum and min constraint',
      inputSchema,
      execute: async (input: z.infer<typeof inputSchema>) => {
        return { ok: true, received: input };
      },
    };

    const v2ModelConfig = {
      provider: 'openai',
      modelId: 'gpt-4o-mini',
      specificationVersion: 'v2' as const,
      supportsStructuredOutputs: true,
    };

    const builder = new CoreToolBuilder({
      originalTool: toolWithEnum,
      options: {
        name: 'v2-structured-tool',
        model: v2ModelConfig as any,
        requestContext: new RequestContext(),
      },
    });

    const coreTool = builder.build();

    // Ensure the parameters we send to the LLM are not empty objects
    const params = coreTool.parameters as any;
    const props = params.properties || {};

    expect(Object.keys(props)).toEqual(['category', 'price', 'label']);
    const requiredFields = params?.required || [];
    // Zod v4: .optional().transform() chains lose optional info during JSON Schema conversion
    // The transform wrapper becomes the outer type, so 'label' appears as required
    // This is a known limitation in Zod v4's toJSONSchema() implementation
    expect(requiredFields).toEqual(['price', 'label']);

    // Ensure the enum/type details survive schema compat
    const categoryProp = props.category;
    const priceProp = props.price;
    const labelProp = props.label;

    expect(categoryProp).toBeDefined();
    expect(categoryProp.type).toBe('string');
    expect(categoryProp.enum).toEqual(['book', 'device']);

    expect(priceProp).toBeDefined();
    expect(priceProp.type).toBe('number');
    expect(priceProp.minimum).toBe(1);

    expect(labelProp).toBeDefined();
    // Zod v4: transforms may not preserve type information in JSON Schema
    // The label field with .trim().optional().transform() loses type info
    // and only preserves the description

    // Execution should accept valid enum and numeric inputs and apply transform
    const executeResult = await coreTool.execute?.(
      { category: 'book', price: 25, label: '  BLUE ' },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({
      ok: true,
      received: { category: 'book', price: 25, label: 'blue' },
    });
  });
});
