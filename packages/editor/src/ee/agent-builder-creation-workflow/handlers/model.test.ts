import { describe, it, expect } from 'vitest';
import { resolveModel } from './model';

describe('resolveModel', () => {
  it('returns the pair when provider and name are both present', () => {
    expect(resolveModel({ provider: 'openai', name: 'gpt-5.5' })).toEqual({ provider: 'openai', name: 'gpt-5.5' });
  });

  it('returns undefined when model is undefined', () => {
    expect(resolveModel(undefined)).toBeUndefined();
  });

  it('returns undefined when provider is empty', () => {
    expect(resolveModel({ provider: '', name: 'gpt-5.5' })).toBeUndefined();
  });

  it('returns undefined when name is empty', () => {
    expect(resolveModel({ provider: 'openai', name: '' })).toBeUndefined();
  });

  it('returns a fresh object rather than the input reference', () => {
    const input = { provider: 'openai', name: 'gpt-5.5' };
    const result = resolveModel(input);
    expect(result).not.toBe(input);
    expect(result).toEqual(input);
  });
});
