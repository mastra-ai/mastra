import { ModelNotAllowedError } from '@mastra/core/agent-builder/ee';
import { describe, expect, it } from 'vitest';

import { HTTPException } from '../http-exception';

import { handleError } from './error';

describe('handleError', () => {
  it('maps ModelNotAllowedError to a 422 HTTPException with structured JSON body', async () => {
    const err = new ModelNotAllowedError({
      allowed: [{ provider: 'openai', modelId: 'gpt-5.5' }],
      attempted: { provider: 'anthropic', modelId: 'claude-opus-4-7', origin: 'static' },
      offendingLabel: 'static',
    });

    let caught: HTTPException | undefined;
    try {
      handleError(err, 'fallback message');
    } catch (e) {
      caught = e as HTTPException;
    }

    expect(caught).toBeInstanceOf(HTTPException);
    expect(caught?.status).toBe(422);

    const response = caught!.getResponse();
    expect(response.status).toBe(422);
    expect(response.headers.get('content-type')).toBe('application/json');

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: 'MODEL_NOT_ALLOWED',
        message: err.message,
        allowed: err.allowed,
        attempted: err.attempted,
        offendingLabel: err.offendingLabel,
      },
    });
  });

  it('preserves existing 500 fallback for non-policy errors', () => {
    let caught: HTTPException | undefined;
    try {
      handleError(new Error('boom'), 'default message');
    } catch (e) {
      caught = e as HTTPException;
    }
    expect(caught?.status).toBe(500);
    expect(caught?.message).toBe('boom');
  });
});
