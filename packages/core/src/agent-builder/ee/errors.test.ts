import { describe, expect, it } from 'vitest';

import { assertModelAllowed } from './allowlist';
import { isModelNotAllowedError, ModelNotAllowedError, MODEL_NOT_ALLOWED_CODE } from './errors';

describe('ModelNotAllowedError', () => {
  it('builds default message from attempted candidate + offendingLabel', () => {
    const err = new ModelNotAllowedError({
      allowed: [{ provider: 'openai', modelId: 'gpt-5.5' }],
      attempted: { provider: 'anthropic', modelId: 'claude-opus-4-7', origin: 'static' },
      offendingLabel: 'static',
    });
    expect(err.code).toBe(MODEL_NOT_ALLOWED_CODE);
    expect(err.name).toBe('ModelNotAllowedError');
    expect(err.message).toContain('anthropic/claude-opus-4-7');
    expect(err.message).toContain('static');
    expect(isModelNotAllowedError(err)).toBe(true);
  });

  it('isModelNotAllowedError narrows arbitrary errors', () => {
    expect(isModelNotAllowedError(new Error('nope'))).toBe(false);
    expect(isModelNotAllowedError({ code: 'MODEL_NOT_ALLOWED' })).toBe(false);
  });
});

describe('assertModelAllowed', () => {
  it('passes through when allowlist is undefined', () => {
    expect(() => assertModelAllowed(undefined, 'openai/gpt-5.5')).not.toThrow();
  });

  it('passes when candidate is in the allowlist', () => {
    expect(() => assertModelAllowed([{ provider: 'openai', modelId: 'gpt-5.5' }], 'openai/gpt-5.5')).not.toThrow();
  });

  it('throws ModelNotAllowedError when candidate is rejected', () => {
    let caught: unknown;
    try {
      assertModelAllowed([{ provider: 'openai', modelId: 'gpt-5.5' }], 'anthropic/claude-opus-4-7');
    } catch (e) {
      caught = e;
    }
    expect(isModelNotAllowedError(caught)).toBe(true);
    if (isModelNotAllowedError(caught)) {
      expect(caught.attempted.provider).toBe('anthropic');
      expect(caught.attempted.modelId).toBe('claude-opus-4-7');
      expect(caught.offendingLabel).toBeTypeOf('string');
    }
  });
});
