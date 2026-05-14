import { describe, expect, it } from 'vitest';
import { AgentBuilderEditFormSchema } from '../schemas';

describe('AgentBuilderEditFormSchema', () => {
  it('accepts name and instructions without tools', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
    });
    expect(result.success).toBe(true);
  });

  it('accepts tools as a record', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
      tools: { 'web-search': true },
    });
    expect(result.success).toBe(true);
  });

  it('requires name', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      instructions: 'Do things',
    });
    expect(result.success).toBe(false);
  });

  it('requires instructions', () => {
    const result = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an optional description', () => {
    const withDescription = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      description: 'Helps with research tasks',
      instructions: 'Do things',
    });
    expect(withDescription.success).toBe(true);

    const without = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
    });
    expect(without.success).toBe(true);
  });

  it('accepts an optional workspaceId', () => {
    const withId = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
      workspaceId: 'workspace-123',
    });
    expect(withId.success).toBe(true);

    const without = AgentBuilderEditFormSchema.safeParse({
      name: 'My agent',
      instructions: 'Do things',
    });
    expect(without.success).toBe(true);
  });

  describe('toolIntegrations', () => {
    const base = { name: 'A', instructions: 'I' };

    it('accepts a valid toolIntegrations record', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: { toolService: 'gmail' } },
            connections: {
              gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'c1', label: 'work' }],
            },
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty labels', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: { toolService: 'gmail' } },
            connections: {
              gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'c1', label: '' }],
            },
          },
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects labels longer than 32 chars', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: { toolService: 'gmail' } },
            connections: {
              gmail: [
                {
                  kind: 'author',
                  toolService: 'gmail',
                  connectionId: 'c1',
                  label: 'x'.repeat(33),
                },
              ],
            },
          },
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects labels with invalid characters', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: { toolService: 'gmail' } },
            connections: {
              gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'c1', label: 'a!b' }],
            },
          },
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects duplicate labels per toolService (case-insensitive)', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: { toolService: 'gmail' } },
            connections: {
              gmail: [
                { kind: 'author', toolService: 'gmail', connectionId: 'c1', label: 'Work' },
                { kind: 'author', toolService: 'gmail', connectionId: 'c2', label: 'work' },
              ],
            },
          },
        },
      });
      expect(result.success).toBe(false);
    });

    it('allows the same label across different toolServices', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: {
              GMAIL_FETCH: { toolService: 'gmail' },
              GITHUB_CREATE: { toolService: 'github' },
            },
            connections: {
              gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'c1', label: 'main' }],
              github: [{ kind: 'author', toolService: 'github', connectionId: 'c2', label: 'main' }],
            },
          },
        },
      });
      expect(result.success).toBe(true);
    });

    it('rejects selected tools whose toolService has zero connections', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: { toolService: 'gmail' } },
            connections: {},
          },
        },
      });
      expect(result.success).toBe(false);
    });

    it('rejects kind values other than "author"', () => {
      const result = AgentBuilderEditFormSchema.safeParse({
        ...base,
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: { toolService: 'gmail' } },
            connections: {
              gmail: [{ kind: 'invoker', toolService: 'gmail', connectionId: 'c1', label: 'a' }],
            },
          },
        },
      });
      expect(result.success).toBe(false);
    });
  });
});
