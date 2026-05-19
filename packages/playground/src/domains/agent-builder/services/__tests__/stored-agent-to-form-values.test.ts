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
});
