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
