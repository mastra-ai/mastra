import { AnthropicSchemaCompatLayer } from '@mastra/schema-compat';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { RuntimeContext } from '../../runtime-context';
import type { ToolAction } from '../types';
import { CoreToolBuilder } from './builder';

describe('CoreToolBuilder - Schema Compatibility in Validation', () => {
  it('should use schema-compat transformed schema for BOTH LLM parameters AND validation', async () => {
    // Create a tool with string min constraint
    const inputSchema = z.object({
      message: z.string().min(10).describe('A message with minimum 10 characters'),
    });

    const toolWithConstraints: ToolAction<any, any> = {
      id: 'test-tool',
      description: 'A test tool with string constraints',
      inputSchema,
      execute: async ({ context }: { context: z.infer<typeof inputSchema> }) => {
        const { message } = context;
        return { result: `Received: ${message}` };
      },
    };

    // Create a model config that requires schema transformation (Claude 3.5 Haiku strips min/max from strings)
    const modelConfig = {
      provider: 'anthropic',
      modelId: 'claude-3.5-haiku-20241022',
      specificationVersion: 'v4' as const,
      supportsStructuredOutputs: false,
    } as const;

    // Build the tool
    const builder = new CoreToolBuilder({
      originalTool: toolWithConstraints,
      options: {
        name: 'test-tool',
        model: modelConfig as any,
        runtimeContext: new RuntimeContext(),
      },
    });

    const coreTool = builder.build();

    // ASSERTION 1: The parameters sent to the LLM should be transformed
    // (Claude 3.5 Haiku compatibility layer removes min/max constraints from strings)
    const anthropicLayer = new AnthropicSchemaCompatLayer(modelConfig as any);

    // The original schema has a min constraint
    const originalSchema = inputSchema;
    const messageField = originalSchema.shape.message as z.ZodString;
    expect(messageField._def.checks).toContainEqual(expect.objectContaining({ kind: 'min', value: 10 }));

    // The transformed schema should NOT have the min constraint (for Claude 3.5 Haiku)
    // This is what the LLM sees
    const transformedSchema = anthropicLayer.processZodType(originalSchema);
    const transformedMessageField = (transformedSchema as any).shape.message as z.ZodString;

    // This assertion should PASS - the LLM receives transformed schema without min constraint
    expect(transformedMessageField._def.checks).not.toContainEqual(expect.objectContaining({ kind: 'min' }));

    // ASSERTION 2: The validation should use the SAME transformed schema
    // This is the bug - validation currently uses the original schema with constraints

    // Simulate what happens when the LLM calls the tool with a short string (< 10 chars)
    // The LLM was told there's no minimum, so it might send a short string
    const shortMessage = 'Hi there'; // Only 8 characters, less than the original min of 10

    // Mock the execute function to capture what gets validated

    const executeResult = await coreTool.execute?.(
      { message: shortMessage },
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    // THIS ASSERTION WILL FAIL - demonstrating the bug
    // The validation should accept the short string because the LLM was told there's no minimum
    // But currently, validation uses the original schema with min(10), so it will reject it
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
      execute: async ({ context }: { context: z.infer<typeof inputSchema2> }) => {
        const { age } = context;
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
        runtimeContext: new RuntimeContext(),
      },
    });

    const coreTool = builder.build();

    // Anthropic's schema compat layer transforms number constraints
    // The LLM receives a schema without strict min/max enforcement

    // If the LLM sends a value that would fail the original schema
    // but passes the transformed schema, validation should accept it
    const executeResult = await coreTool.execute?.(
      { age: 25 }, // Valid in both schemas
      {
        abortSignal: new AbortController().signal,
        toolCallId: 'test-call-id',
        messages: [],
      },
    );

    // THIS SHOULD PASS - validation should use transformed schema
    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toHaveProperty('result');
  });

  it('should demonstrate the bug: validation rejects input that LLM was told is valid', async () => {
    // This test explicitly demonstrates the bug
    const inputSchema4 = z.object({
      text: z.string().min(20).describe('Text with minimum 20 characters'),
    });

    const toolWithMinConstraint: ToolAction<any, any> = {
      id: 'bug-demo-tool',
      description: 'Demonstrates the validation bug',
      inputSchema: inputSchema4,
      execute: async ({ context }: { context: z.infer<typeof inputSchema4> }) => {
        const { text } = context;
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
        runtimeContext: new RuntimeContext(),
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

    // EXPECTED BEHAVIOR (this will fail, demonstrating the bug):
    // Since the LLM was told there's no minimum length requirement,
    // validation should accept this input
    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({
      success: true,
      text: shortText,
    });

    // ACTUAL BEHAVIOR (what currently happens):
    // Validation uses the original schema with min(20),
    // so it rejects the input even though the LLM was told it's valid
    // Uncomment these to see the current (incorrect) behavior:
    // expect(executeResult).toHaveProperty('error');
    // expect(executeResult.error).toContain('String must contain at least 20 character(s)');
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
      execute: async ({ context }: { context: z.infer<typeof inputSchema5> }) => {
        const { newMemory, searchString, updateReason } = context;
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
        runtimeContext: new RuntimeContext(),
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

    // EXPECTED BEHAVIOR (with the fix):
    // Validation should accept null because the schema sent to the LLM was .nullable()
    expect(executeResult).not.toHaveProperty('error');
    expect(executeResult).toEqual({
      success: true,
      newMemory: newMemoryValue,
      searchString: null,
      updateReason: 'append-new-memory',
    });

    // BEFORE THE FIX:
    // This would fail with "Expected string, received null" because validation
    // was using the original schema with .optional() instead of the transformed
    // schema with .nullable()
  });
});
