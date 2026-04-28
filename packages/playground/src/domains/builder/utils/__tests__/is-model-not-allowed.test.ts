import { MODEL_NOT_ALLOWED_CODE } from '@mastra/core/agent-builder/ee';
import { describe, expect, it } from 'vitest';
import { isModelNotAllowedError } from '../is-model-not-allowed';

describe('isModelNotAllowedError', () => {
  it('returns details for a 422 + MODEL_NOT_ALLOWED body', () => {
    const err = {
      status: 422,
      body: {
        error: {
          code: MODEL_NOT_ALLOWED_CODE,
          message: 'Model openai/gpt-4o is not in the allowed list',
          attempted: { provider: 'openai', modelId: 'gpt-4o' },
          offendingLabel: 'openai/gpt-4o',
        },
      },
    };

    expect(isModelNotAllowedError(err)).toEqual({
      message: 'Model openai/gpt-4o is not in the allowed list',
      attempted: { provider: 'openai', modelId: 'gpt-4o' },
      offendingLabel: 'openai/gpt-4o',
    });
  });

  it('returns null for non-422 errors', () => {
    expect(isModelNotAllowedError({ status: 500, body: { error: { code: MODEL_NOT_ALLOWED_CODE } } })).toBeNull();
  });

  it('returns null when code does not match', () => {
    expect(isModelNotAllowedError({ status: 422, body: { error: { code: 'OTHER' } } })).toBeNull();
  });

  it('returns null for non-objects', () => {
    expect(isModelNotAllowedError(null)).toBeNull();
    expect(isModelNotAllowedError(undefined)).toBeNull();
    expect(isModelNotAllowedError('boom')).toBeNull();
  });

  it('falls back to a generic message when body is missing message', () => {
    const result = isModelNotAllowedError({ status: 422, body: { error: { code: MODEL_NOT_ALLOWED_CODE } } });
    expect(result?.message).toBe('Model not allowed by admin policy');
  });
});
