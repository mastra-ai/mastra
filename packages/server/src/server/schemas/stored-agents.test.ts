import { describe, expect, it } from 'vitest';
import { createStoredAgentBodySchema, updateStoredAgentBodySchema, storedAgentSchema } from './stored-agents';

describe('stored-agents schemas – conditional fields & requestContextSchema', () => {
  // ---------------------------------------------------------------------------
  // conditionalFieldSchema (via createStoredAgentBodySchema)
  // ---------------------------------------------------------------------------

  describe('conditionalFieldSchema', () => {
    it('should accept a static model config', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
      });
      expect(result.success).toBe(true);
    });

    it('should accept a conditional model config (array of variants)', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: [
          {
            value: { provider: 'anthropic', name: 'claude-3-opus' },
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
            },
          },
          {
            value: { provider: 'openai', name: 'gpt-4o-mini' },
            // No rules = fallback
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept static tools config', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
        tools: { 'my-tool': { description: 'A tool' } },
      });
      expect(result.success).toBe(true);
    });

    it('should accept conditional tools config', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
        tools: [
          {
            value: { 'premium-tool': {} },
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
            },
          },
          {
            value: { 'basic-tool': {} },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it.skip('should accept conditional workflows', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
        workflows: [
          {
            value: ['wf-a', 'wf-b'],
            rules: {
              operator: 'OR',
              conditions: [
                { field: 'env', operator: 'equals', value: 'prod' },
                { field: 'env', operator: 'equals', value: 'staging' },
              ],
            },
          },
          {
            value: ['wf-c'],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept conditional memory config', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
        memory: [
          {
            value: { options: { readOnly: true } },
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'free' }],
            },
          },
          {
            value: { options: { readOnly: false } },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept conditional defaultOptions', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
        defaultOptions: [
          {
            value: { maxSteps: 20 },
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
            },
          },
          {
            value: { maxSteps: 5 },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept nested rule groups in conditional fields', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: [
          {
            value: { provider: 'anthropic', name: 'claude-3-opus' },
            rules: {
              operator: 'AND',
              conditions: [
                { field: 'tier', operator: 'equals', value: 'enterprise' },
                {
                  operator: 'OR',
                  conditions: [
                    { field: 'region', operator: 'equals', value: 'us' },
                    { field: 'region', operator: 'equals', value: 'eu' },
                  ],
                },
              ],
            },
          },
          {
            value: { provider: 'openai', name: 'gpt-4o-mini' },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid conditional variant (missing value)', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: [
          {
            // Missing `value`
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
            },
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // requestContextSchema
  // ---------------------------------------------------------------------------

  describe('requestContextSchema', () => {
    it('should accept requestContextSchema as a JSON Schema object', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
        requestContextSchema: {
          type: 'object',
          properties: {
            tier: { type: 'string', enum: ['free', 'premium', 'enterprise'] },
            locale: { type: 'string' },
          },
          required: ['tier'],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should allow omitting requestContextSchema', () => {
      const result = createStoredAgentBodySchema.safeParse({
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
      });
      expect(result.success).toBe(true);
    });

    it('should include requestContextSchema in storedAgentSchema response', () => {
      const now = new Date();
      const result = storedAgentSchema.safeParse({
        id: 'test-id',
        status: 'published',
        createdAt: now,
        updatedAt: now,
        name: 'Test Agent',
        instructions: 'Hello',
        model: { provider: 'openai', name: 'gpt-4' },
        requestContextSchema: {
          type: 'object',
          properties: {
            tier: { type: 'string' },
          },
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requestContextSchema).toEqual({
          type: 'object',
          properties: {
            tier: { type: 'string' },
          },
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // updateStoredAgentBodySchema with conditional fields
  // ---------------------------------------------------------------------------

  describe('updateStoredAgentBodySchema', () => {
    it('should accept partial updates with conditional model', () => {
      const result = updateStoredAgentBodySchema.safeParse({
        model: [
          {
            value: { provider: 'anthropic', name: 'claude-3-opus' },
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
            },
          },
          {
            value: { provider: 'openai', name: 'gpt-4o-mini' },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept partial updates with conditional tools', () => {
      const result = updateStoredAgentBodySchema.safeParse({
        tools: [
          {
            value: { 'premium-tool': {} },
            rules: {
              operator: 'AND',
              conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }],
            },
          },
          {
            value: {},
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should accept null memory to disable it', () => {
      const result = updateStoredAgentBodySchema.safeParse({
        memory: null,
      });
      expect(result.success).toBe(true);
    });

    it('should accept requestContextSchema in updates', () => {
      const result = updateStoredAgentBodySchema.safeParse({
        requestContextSchema: {
          type: 'object',
          properties: {
            env: { type: 'string' },
          },
        },
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('stored-agents schemas – memory references', () => {
  const base = { name: 'Support Agent', instructions: 'Help', model: { provider: 'openai', name: 'gpt-4o' } };
  const parseMemory = (memory: unknown) => createStoredAgentBodySchema.safeParse({ ...base, memory });

  it('accepts a registered memory reference', () => {
    const result = parseMemory({ type: 'id', memoryId: 'chat' });
    expect(result.success).toBe(true);
    expect(result.data?.memory).toEqual({ type: 'id', memoryId: 'chat' });
  });

  it('accepts a tagged inline config', () => {
    const result = parseMemory({ type: 'inline', config: { options: { lastMessages: 10 } } });
    expect(result.success).toBe(true);
    expect(result.data?.memory).toEqual({ type: 'inline', config: { options: { lastMessages: 10 } } });
  });

  it('accepts a legacy untagged inline config', () => {
    const result = parseMemory({ options: { lastMessages: 10 }, observationalMemory: true });
    expect(result.success).toBe(true);
    expect(result.data?.memory).toEqual({ options: { lastMessages: 10 }, observationalMemory: true });
  });

  it('accepts references and inline configs in conditional variants', () => {
    const result = parseMemory([
      { value: { options: { lastMessages: 5 } } },
      {
        value: { type: 'id', memoryId: 'premium' },
        rules: { operator: 'AND', conditions: [{ field: 'tier', operator: 'equals', value: 'premium' }] },
      },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects a reference without a memoryId instead of treating it as empty inline config', () => {
    expect(parseMemory({ type: 'id' }).success).toBe(false);
    expect(parseMemory({ type: 'id', memoryId: '' }).success).toBe(false);
  });

  it('rejects unknown memory types', () => {
    expect(parseMemory({ type: 'memory_ref', key: 'chat' }).success).toBe(false);
  });

  it('still enforces semantic recall dependencies on legacy and tagged inline configs', () => {
    const config = { options: { semanticRecall: true } };
    expect(parseMemory(config).success).toBe(false);
    expect(parseMemory({ type: 'inline', config }).success).toBe(false);
  });

  it('accepts references on update and in the response schema', () => {
    expect(updateStoredAgentBodySchema.safeParse({ memory: { type: 'id', memoryId: 'chat' } }).success).toBe(true);
    const response = storedAgentSchema.safeParse({
      id: 'support',
      status: 'published',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...base,
      memory: { type: 'id', memoryId: 'chat' },
    });
    expect(response.success).toBe(true);
    expect(response.data?.memory).toEqual({ type: 'id', memoryId: 'chat' });
  });
});

describe('stored-agents schemas – instruction blocks', () => {
  it('preserves per-usage rules on prompt_block_ref blocks', () => {
    const refBlock = {
      type: 'prompt_block_ref',
      id: 'shared-default-user-prompt',
      rules: { operator: 'AND', conditions: [{ field: 'userPrompt', operator: 'not_exists' }] },
    };
    const result = createStoredAgentBodySchema.safeParse({
      name: 'Test Agent',
      instructions: [refBlock],
      model: { provider: 'openai', name: 'gpt-4' },
    });
    expect(result.success).toBe(true);
    expect(result.data?.instructions).toEqual([refBlock]);
  });
});
