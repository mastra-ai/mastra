import { describe, expect, it } from 'vitest';
import { storedAgentToAgentConfig } from '../stored-agent-to-agent-config';

describe('storedAgentToAgentConfig', () => {
  it('uses the fallback id when storedAgent is null or undefined', () => {
    expect(storedAgentToAgentConfig(null, 'fallback-id')).toEqual({
      id: 'fallback-id',
      name: '',
      description: '',
      systemPrompt: '',
      visibility: 'private',
      avatarUrl: undefined,
      authorId: undefined,
    });
    expect(storedAgentToAgentConfig(undefined, 'fallback-id')).toEqual({
      id: 'fallback-id',
      name: '',
      description: '',
      systemPrompt: '',
      visibility: 'private',
      avatarUrl: undefined,
      authorId: undefined,
    });
  });

  it('uses storedAgent.id when present and copies over name/description/instructions', () => {
    const result = storedAgentToAgentConfig(
      {
        id: 'stored-id',
        name: 'Researcher',
        description: 'Helps with research',
        instructions: 'Be helpful',
      } as never,
      'fallback-id',
    );

    expect(result).toEqual({
      id: 'stored-id',
      name: 'Researcher',
      description: 'Helps with research',
      systemPrompt: 'Be helpful',
      visibility: 'private',
      avatarUrl: undefined,
      authorId: undefined,
    });
  });

  it('falls back to empty string when instructions is not a string', () => {
    const result = storedAgentToAgentConfig(
      { id: 'a', name: 'N', instructions: { type: 'rule' } } as never,
      'fallback-id',
    );

    expect(result.systemPrompt).toBe('');
  });
});
