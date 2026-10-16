import { MastraClientError } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { getAgentRunVersionSelectorErrorCode, isAgentRunAuthorizationError } from '../agent-run-version-selector-error';

describe('getAgentRunVersionSelectorErrorCode', () => {
  it('reads stable selector codes from SDK HTTP errors', () => {
    const error = new MastraClientError(404, 'Not Found', 'Missing label', {
      error: { code: 'LABEL_NOT_FOUND', message: 'The label no longer exists.' },
    });

    expect(getAgentRunVersionSelectorErrorCode(error)).toBe('LABEL_NOT_FOUND');
  });

  it.each([
    'INVALID_VERSION_SELECTOR',
    'ENTITY_NOT_FOUND',
    'VERSION_NOT_FOUND',
    'LABEL_NOT_FOUND',
    'VERSION_LABEL_INTEGRITY_ERROR',
    'VERSION_LABELS_UNSUPPORTED',
  ] as const)('reads %s from a streamed error envelope', code => {
    expect(
      getAgentRunVersionSelectorErrorCode({
        error: { code, message: 'Run target rejected.' },
      }),
    ).toBe(code);
  });

  it('reads selector codes from top-level and HTTP body envelopes', () => {
    expect(getAgentRunVersionSelectorErrorCode({ code: 'VERSION_NOT_FOUND' })).toBe('VERSION_NOT_FOUND');
    expect(getAgentRunVersionSelectorErrorCode({ body: { error: { code: 'VERSION_LABELS_UNSUPPORTED' } } })).toBe(
      'VERSION_LABELS_UNSUPPORTED',
    );
  });

  it('ignores unrelated transport errors and untrusted string messages', () => {
    expect(getAgentRunVersionSelectorErrorCode({ error: { code: 'MODEL_NOT_FOUND' } })).toBeUndefined();
    expect(getAgentRunVersionSelectorErrorCode('LABEL_NOT_FOUND')).toBeUndefined();
  });

  it('recognizes a live HTTP authorization rejection without trusting arbitrary messages', () => {
    const forbidden = new MastraClientError(403, 'Forbidden', 'Permission revoked');

    expect(isAgentRunAuthorizationError(forbidden)).toBe(true);
    expect(isAgentRunAuthorizationError({ status: 403 })).toBe(true);
    expect(isAgentRunAuthorizationError('403 Forbidden')).toBe(false);
    expect(isAgentRunAuthorizationError({ status: 401 })).toBe(false);
    expect(isAgentRunAuthorizationError(new MastraClientError(404, 'Not Found', 'Missing'))).toBe(false);
  });
});
