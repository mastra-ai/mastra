import { openai } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import type { ToolToConvert } from './builder';
import { OPENAI_TOOL_DESCRIPTION_MAX_LENGTH, ToolCompatibility } from './index';

vi.mock('./provider-compats/anthropic', () => ({}));
vi.mock('./provider-compats/google', () => ({}));
vi.mock('./provider-compats/openai', () => ({}));
vi.mock('./provider-compats/openai-reasoning', () => ({}));

// Minimal concrete implementation for testing
class TestToolCompatibility extends ToolCompatibility {
  shouldApply() {
    return true;
  }
  getSchemaTarget() {
    return undefined;
  }
  processZodType(value: any) {
    return value;
  }
  constructor(model: any) {
    super(model);
    // @ts-ignore
    this.logger = { warn: vi.fn() };
  }
}

describe('ToolCompatibility.process tool description truncation', () => {
  const baseTool: ToolToConvert = {
    id: 'test',
    description: '',
    inputSchema: z.object({ foo: z.string() }),
    execute: async () => ({}),
  };

  const openaiModel = openai('o3-mini');
  const openrouter = createOpenRouter({ apiKey: 'dummy' });
  const anthropicModel = openrouter('anthropic/claude-3.5-sonnet');

  it('does not truncate if description is under the limit', () => {
    const tool = { ...baseTool, description: 'a'.repeat(100) };
    const compat = new TestToolCompatibility(openaiModel);
    // Patch zodToAISDKSchema to return empty constraints
    // @ts-ignore
    compat.zodToAISDKSchema = () => ({ schema: z.object({ foo: z.string() }), constraints: { foo: { minLength: 1 } } });
    const result = compat.process(tool);
    expect(result.description!.length).toBeGreaterThan(tool.description.length);
  });

  it('truncates if description+constraints is over the limit and tool.description is under the limit (OpenAI)', () => {
    // Make description just under the limit, and constraints big enough to push over
    const tool = { ...baseTool, description: 'a'.repeat(1000) };
    const compat = new TestToolCompatibility(openaiModel);
    const bigConstraints = { foo: { minLength: 1, maxLength: 1000, extra: 'x'.repeat(1000) } };
    // @ts-ignore
    compat.zodToAISDKSchema = () => ({ schema: z.object({ foo: z.string() }), constraints: bigConstraints });
    const result = compat.process(tool);
    // Should be truncated to 1020 chars
    expect(result.description!.length).toBeLessThanOrEqual(OPENAI_TOOL_DESCRIPTION_MAX_LENGTH);
  });

  it('does not truncate if tool.description is also over the limit even if there are constraints (should return OpenAI error as is)', () => {
    const tool = { ...baseTool, description: 'a'.repeat(2000) };
    const compat = new TestToolCompatibility(openaiModel);
    // Patch zodToAISDKSchema to return empty constraints
    // @ts-ignore
    compat.zodToAISDKSchema = () => ({ schema: z.object({ foo: z.string() }), constraints: { foo: { minLength: 1 } } });
    const result = compat.process(tool);
    expect(result.description!).toBe(tool.description);
  });

  it('does not truncate for non-OpenAI models', () => {
    const tool = { ...baseTool, description: 'a'.repeat(2000) };
    const compat = new TestToolCompatibility(anthropicModel);
    // Patch zodToAISDKSchema to return empty constraints
    // @ts-ignore
    compat.zodToAISDKSchema = () => ({ schema: z.object({ foo: z.string() }), constraints: {} });
    const result = compat.process(tool);
    expect(result.description!).toBe(tool.description);
  });
});
