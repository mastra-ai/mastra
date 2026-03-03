import { afterEach, describe, expect, it } from 'vitest';
import { createAuthStorage } from '../index.js';
import { getAuthStorage as getClaudeAuthStorage, setAuthStorage as setClaudeAuthStorage } from '../providers/claude-max.js';
import { getAuthStorage as getOpenAIAuthStorage, setAuthStorage as setOpenAIAuthStorage } from '../providers/openai-codex.js';

describe('createAuthStorage', () => {
  afterEach(() => {
    setClaudeAuthStorage(undefined);
    setOpenAIAuthStorage(undefined);
  });

  it('wires a shared auth storage instance to provider modules', () => {
    const authStorage = createAuthStorage();

    expect(getClaudeAuthStorage()).toBe(authStorage);
    expect(getOpenAIAuthStorage()).toBe(authStorage);
  });
});
