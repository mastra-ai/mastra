import { describe, expect, it } from 'vitest';
import { storedAgentToAgentConfig } from '../stored-agent-to-agent-config';

describe('storedAgentToAgentConfig', () => {
  it('uses the fallback id when storedAgent is null or undefined', () => {
    expect(storedAgentToAgentConfig(null, 'fallback-id')).toEqual({
      id: 'fallback-id',
      name: '',
      description: '',
      systemPrompt: '',
      authorId: undefined,
      visibility: 'private',
      avatarUrl: undefined,
    });
    expect(storedAgentToAgentConfig(undefined, 'fallback-id')).toEqual({
      id: 'fallback-id',
      name: '',
      description: '',
      systemPrompt: '',
      authorId: undefined,
      visibility: 'private',
      avatarUrl: undefined,
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
      authorId: undefined,
      visibility: 'private',
      avatarUrl: undefined,
    });
  });

  it('falls back to empty string when instructions is not a string', () => {
    const result = storedAgentToAgentConfig(
      { id: 'a', name: 'N', instructions: { type: 'rule' } } as never,
      'fallback-id',
    );

    expect(result.systemPrompt).toBe('');
  });

  it('extracts avatarUrl from metadata when present', () => {
    const result = storedAgentToAgentConfig(
      { id: 'a', name: 'N', metadata: { avatarUrl: 'https://cdn.example/a.png' } } as never,
      'fallback-id',
    );

    expect(result.avatarUrl).toBe('https://cdn.example/a.png');
  });

  it('leaves avatarUrl undefined when metadata is present but lacks avatarUrl', () => {
    const result = storedAgentToAgentConfig(
      { id: 'a', name: 'N', metadata: { other: 'value' } } as never,
      'fallback-id',
    );

    expect(result.avatarUrl).toBeUndefined();
  });

  it('preserves visibility=public when set', () => {
    const result = storedAgentToAgentConfig({ id: 'a', name: 'N', visibility: 'public' } as never, 'fallback-id');

    expect(result.visibility).toBe('public');
  });

  it('preserves authorId when set to a string', () => {
    const result = storedAgentToAgentConfig({ id: 'a', name: 'N', authorId: 'user-1' } as never, 'fallback-id');

    expect(result.authorId).toBe('user-1');
  });

  it('preserves authorId when set to null', () => {
    const result = storedAgentToAgentConfig({ id: 'a', name: 'N', authorId: null } as never, 'fallback-id');

    expect(result.authorId).toBeNull();
  });
});
