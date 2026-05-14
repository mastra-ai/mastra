import { describe, expect, it } from 'vitest';
import { storedAgentToFormValues } from '../stored-agent-to-form-values';

describe('storedAgentToFormValues', () => {
  it('returns empty defaults when storedAgent is null or undefined', () => {
    const fromNull = storedAgentToFormValues(null);
    const fromUndefined = storedAgentToFormValues(undefined);

    const expected = {
      name: '',
      description: '',
      instructions: '',
      tools: {},
      agents: {},
      workflows: {},
      skills: {},
      workspaceId: undefined,
      visibility: undefined,
      avatarUrl: undefined,
      browserEnabled: false,
      model: undefined,
      toolIntegrations: undefined,
    };

    expect(fromNull).toEqual(expected);
    expect(fromUndefined).toEqual(expected);
  });

  it('maps every stored agent field into the form value shape', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'Researcher',
      description: 'Helps with research',
      instructions: 'Be helpful',
      tools: { 'tool-a': {}, 'tool-b': {} },
      agents: { 'agent-x': {} },
      workflows: { 'wf-1': {} },
      workspace: { type: 'id', workspaceId: 'ws-1' },
    } as never);

    expect(result).toEqual({
      name: 'Researcher',
      description: 'Helps with research',
      instructions: 'Be helpful',
      tools: { 'tool-a': true, 'tool-b': true },
      agents: { 'agent-x': true },
      workflows: { 'wf-1': true },
      skills: {},
      workspaceId: 'ws-1',
      visibility: undefined,
      avatarUrl: undefined,
      browserEnabled: false,
      model: undefined,
      toolIntegrations: undefined,
    });
  });

  it('hydrates skills from a flat record', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      skills: { s1: { description: 'desc' }, s2: {} },
    } as never);

    expect(result.skills).toEqual({ s1: true, s2: true });
  });

  it('merges skills across ConditionalField variants', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      skills: [
        { when: { type: 'always' }, value: { s1: { description: 'one' } } },
        { when: { type: 'always' }, value: { s2: {} } },
      ],
    } as never);

    expect(result.skills).toEqual({ s1: true, s2: true });
  });

  it('falls back to empty string when instructions is not a string', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      instructions: { type: 'rule' },
    } as never);

    expect(result.instructions).toBe('');
  });

  describe('toolIntegrations', () => {
    it('denormalizes toolService onto each tool entry by joining against connections keys', () => {
      const result = storedAgentToFormValues({
        id: 'agent-1',
        name: 'A',
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: {}, GITHUB_CREATE_ISSUE: { description: 'issues' } },
            connections: {
              gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'c1', label: 'work' }],
              github: [{ kind: 'author', toolService: 'github', connectionId: 'c2', label: 'main' }],
            },
          },
        },
      } as never);

      expect(result.toolIntegrations).toEqual({
        composio: {
          tools: {
            GMAIL_FETCH: { toolService: 'gmail' },
            GITHUB_CREATE_ISSUE: { toolService: 'github', description: 'issues' },
          },
          connections: {
            gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'c1', label: 'work' }],
            github: [{ kind: 'author', toolService: 'github', connectionId: 'c2', label: 'main' }],
          },
        },
      });
    });

    it('preserves unknown passthrough fields on connections (metadata)', () => {
      const result = storedAgentToFormValues({
        id: 'agent-1',
        name: 'A',
        toolIntegrations: {
          composio: {
            tools: { GMAIL_FETCH: {} },
            connections: {
              gmail: [
                {
                  kind: 'author',
                  toolService: 'gmail',
                  connectionId: 'c1',
                  label: 'work',
                  metadata: { foo: 'bar' },
                },
              ],
            },
          },
        },
      } as never);

      const conn = result.toolIntegrations?.composio.connections.gmail?.[0] as unknown as Record<string, unknown>;
      expect(conn?.metadata).toEqual({ foo: 'bar' });
    });

    it('returns undefined for a conditional variant array', () => {
      const result = storedAgentToFormValues({
        id: 'agent-1',
        name: 'A',
        toolIntegrations: [{ when: { type: 'always' }, value: { composio: { tools: {}, connections: {} } } }],
      } as never);

      expect(result.toolIntegrations).toBeUndefined();
    });
  });
});
