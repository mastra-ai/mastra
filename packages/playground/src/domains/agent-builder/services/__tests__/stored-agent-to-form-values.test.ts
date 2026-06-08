import { describe, expect, it } from 'vitest';
import { extractStaticModel, isConditionalStoredModel, storedAgentToFormValues } from '../stored-agent-to-form-values';

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

  it('hydrates a static model into the form value', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      model: { provider: 'openai', name: 'gpt-4o' },
    } as never);

    expect(result.model).toEqual({ provider: 'openai', name: 'gpt-4o' });
  });

  it('leaves model undefined for conditional stored models', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      model: [{ when: { type: 'always' }, value: { provider: 'openai', name: 'gpt-4o' } }],
    } as never);

    expect(result.model).toBeUndefined();
  });

  it('propagates metadata.avatarUrl into the form value', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      metadata: { avatarUrl: 'https://cdn.example/a.png' },
    } as never);

    expect(result.avatarUrl).toBe('https://cdn.example/a.png');
  });

  it('leaves avatarUrl undefined when metadata exists without the key', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      metadata: { other: 'value' },
    } as never);

    expect(result.avatarUrl).toBeUndefined();
  });

  it('propagates visibility and browserEnabled=true when browser is non-null', () => {
    const result = storedAgentToFormValues({
      id: 'agent-1',
      name: 'A',
      visibility: 'public',
      browser: { enabled: true },
    } as never);

    expect(result.visibility).toBe('public');
    expect(result.browserEnabled).toBe(true);
  });
});

describe('extractStaticModel', () => {
  it('returns undefined for undefined input', () => {
    expect(extractStaticModel(undefined)).toBeUndefined();
  });

  it('returns undefined for a conditional (array) input', () => {
    expect(
      extractStaticModel([{ when: { type: 'always' }, value: { provider: 'openai', name: 'gpt-4o' } }] as never),
    ).toBeUndefined();
  });

  it('returns undefined when provider is missing or empty', () => {
    expect(extractStaticModel({ name: 'gpt-4o' } as never)).toBeUndefined();
    expect(extractStaticModel({ provider: '', name: 'gpt-4o' } as never)).toBeUndefined();
    expect(extractStaticModel({ provider: 42, name: 'gpt-4o' } as never)).toBeUndefined();
  });

  it('returns undefined when name is missing or empty', () => {
    expect(extractStaticModel({ provider: 'openai' } as never)).toBeUndefined();
    expect(extractStaticModel({ provider: 'openai', name: '' } as never)).toBeUndefined();
    expect(extractStaticModel({ provider: 'openai', name: 42 } as never)).toBeUndefined();
  });

  it('returns the static model when both provider and name are valid strings', () => {
    expect(extractStaticModel({ provider: 'openai', name: 'gpt-4o' } as never)).toEqual({
      provider: 'openai',
      name: 'gpt-4o',
    });
  });
});

describe('isConditionalStoredModel', () => {
  it('returns true for array input', () => {
    expect(isConditionalStoredModel([] as never)).toBe(true);
  });

  it('returns false for object input', () => {
    expect(isConditionalStoredModel({ provider: 'openai', name: 'gpt-4o' } as never)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isConditionalStoredModel(undefined)).toBe(false);
  });
});
