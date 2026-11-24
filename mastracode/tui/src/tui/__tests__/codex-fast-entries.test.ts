import { describe, expect, it } from 'vitest';
import { withFastEntries } from '../codex-fast-entries.js';

const sol = { id: 'openai/gpt-6.2-sol', modelName: 'gpt-6.2-sol', hasApiKey: true };
const authWith = (type: 'oauth' | 'api_key') => ({ get: () => ({ type }) }) as any;

describe('withFastEntries', () => {
  it('adds the Fast entry with a ChatGPT sign-in', () => {
    expect(withFastEntries([sol], { authStorage: authWith('oauth') }).map(model => model.id)).toEqual([
      'openai/gpt-6.2-sol',
      'openai/gpt-6.2-sol:fast',
    ]);
  });

  it('adds nothing with an API key or no sign-in', () => {
    expect(withFastEntries([sol], { authStorage: authWith('api_key') })).toEqual([sol]);
    expect(withFastEntries([sol], {})).toEqual([sol]);
  });

  it("leaves a Factory's list as the Factory sent it, whatever this machine is signed in to", () => {
    expect(
      withFastEntries([sol], { authStorage: authWith('oauth'), factory: { url: 'https://factory.test' } }),
    ).toEqual([sol]);
  });
});
