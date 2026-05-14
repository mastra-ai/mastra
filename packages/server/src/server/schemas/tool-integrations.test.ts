import { describe, expect, it } from 'vitest';
import { connectionSchema, toolIntegrationConfigSchema, toolIntegrationsSchema } from './tool-integrations';

describe('tool-integrations schemas (v1 Agent Builder tool integrations)', () => {
  describe('connectionSchema', () => {
    it('accepts a minimal author connection', () => {
      const result = connectionSchema.safeParse({
        kind: 'author',
        toolService: 'gmail',
        connectionId: 'ca_123',
        label: 'Work',
      });
      expect(result.success).toBe(true);
    });

    it('accepts invoker and platform kinds (forward-compat)', () => {
      for (const kind of ['invoker', 'platform'] as const) {
        const result = connectionSchema.safeParse({
          kind,
          toolService: 'gmail',
          connectionId: '',
          label: 'X',
        });
        expect(result.success).toBe(true);
      }
    });

    it('rejects an unknown kind', () => {
      const result = connectionSchema.safeParse({
        kind: 'other',
        toolService: 'gmail',
        connectionId: 'ca_1',
        label: 'X',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty label', () => {
      const result = connectionSchema.safeParse({
        kind: 'author',
        toolService: 'gmail',
        connectionId: 'ca_1',
        label: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a label longer than 32 chars', () => {
      const result = connectionSchema.safeParse({
        kind: 'author',
        toolService: 'gmail',
        connectionId: 'ca_1',
        label: 'a'.repeat(33),
      });
      expect(result.success).toBe(false);
    });

    it('rejects a label with disallowed characters', () => {
      const result = connectionSchema.safeParse({
        kind: 'author',
        toolService: 'gmail',
        connectionId: 'ca_1',
        label: 'Work!',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an empty toolService', () => {
      const result = connectionSchema.safeParse({
        kind: 'author',
        toolService: '',
        connectionId: 'ca_1',
        label: 'Work',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('toolIntegrationConfigSchema', () => {
    it('accepts an empty config', () => {
      const result = toolIntegrationConfigSchema.safeParse({ tools: {}, connections: {} });
      expect(result.success).toBe(true);
    });

    it('accepts a single connection per tool service', () => {
      const result = toolIntegrationConfigSchema.safeParse({
        tools: { 'gmail.fetch_emails': {} },
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects duplicate labels within one tool service (case-insensitive)', () => {
      const result = toolIntegrationConfigSchema.safeParse({
        tools: {},
        connections: {
          gmail: [
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_2', label: 'work' },
          ],
        },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some(i => i.path.includes('label'))).toBe(true);
      }
    });

    it('allows identical labels across different tool services', () => {
      const result = toolIntegrationConfigSchema.safeParse({
        tools: {},
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
          slack: [{ kind: 'author', toolService: 'slack', connectionId: 'ca_2', label: 'Work' }],
        },
      });
      expect(result.success).toBe(true);
    });

    it('accepts a per-tool description override', () => {
      const result = toolIntegrationConfigSchema.safeParse({
        tools: { 'gmail.fetch_emails': { description: 'Use this for work mail' } },
        connections: {},
      });
      expect(result.success).toBe(true);
    });
  });

  describe('toolIntegrationsSchema', () => {
    it('accepts a single-integration payload', () => {
      const result = toolIntegrationsSchema.safeParse({
        composio: {
          tools: {},
          connections: {
            gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('surfaces nested label-uniqueness errors', () => {
      const result = toolIntegrationsSchema.safeParse({
        composio: {
          tools: {},
          connections: {
            gmail: [
              { kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
              { kind: 'author', toolService: 'gmail', connectionId: 'ca_2', label: 'Work' },
            ],
          },
        },
      });
      expect(result.success).toBe(false);
    });
  });
});
