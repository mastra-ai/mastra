import { MastraClientError } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { isModelNotAllowedError } from '../is-model-not-allowed';

/**
 * The save/autosave flows use this to swap the generic "Failed to save agent"
 * toast for the admin's policy message. It must recognize what
 * `MastraClientError` actually carries — a 422 with the code nested under
 * `body.error` — not just a bare top-level `code`.
 */
const policyRejection = (message = 'gpt-4o is not allowed by policy') =>
  new MastraClientError(422, 'Unprocessable Entity', `HTTP error! status: 422`, {
    error: { code: 'MODEL_NOT_ALLOWED', message },
  });

describe('isModelNotAllowedError', () => {
  describe('when the server rejects the model with its 422 envelope', () => {
    it('surfaces the policy message', () => {
      expect(isModelNotAllowedError(policyRejection())).toEqual({
        message: 'gpt-4o is not allowed by policy',
      });
    });

    it('falls back to the error message when the body carries none', () => {
      const error = new MastraClientError(422, 'Unprocessable Entity', 'boom', {
        error: { code: 'MODEL_NOT_ALLOWED' },
      });

      expect(isModelNotAllowedError(error)).toEqual({ message: 'boom' });
    });
  });

  describe('when the error carries a bare top-level code', () => {
    it('still recognizes it', () => {
      expect(isModelNotAllowedError({ code: 'MODEL_NOT_ALLOWED' })).toEqual({
        message: 'Model is not allowed',
      });
    });

    it('uses the error message when it is a real Error', () => {
      const error = Object.assign(new Error('blocked by policy'), { code: 'MODEL_NOT_ALLOWED' });

      expect(isModelNotAllowedError(error)).toEqual({ message: 'blocked by policy' });
    });
  });

  describe('when the failure is something else', () => {
    it.each([
      ['a 422 with a different code', new MastraClientError(422, '', 'x', { error: { code: 'OTHER' } })],
      ['a 500 carrying the policy code', new MastraClientError(500, '', 'x', { error: { code: 'MODEL_NOT_ALLOWED' } })],
      ['a plain error', new Error('network down')],
      ['a string', 'MODEL_NOT_ALLOWED'],
      ['null', null],
      ['undefined', undefined],
    ])('reports no policy rejection for %s', (_label, error) => {
      expect(isModelNotAllowedError(error)).toBeNull();
    });
  });
});
