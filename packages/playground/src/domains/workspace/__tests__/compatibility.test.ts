import { describe, expect, it } from 'vitest';
import { isWorkspaceFilesystemUnavailableError, shouldRetryWorkspaceQuery } from '../compatibility';

describe('shouldRetryWorkspaceQuery', () => {
  it('does not retry textual 404 errors from client-js', () => {
    const error = new Error('HTTP error! status: 404 - {"error":"No workspace filesystem configured"}');

    expect(shouldRetryWorkspaceQuery(0, error)).toBe(false);
  });

  it('detects missing workspace filesystem errors from client-js messages', () => {
    const error = new Error('HTTP error! status: 404 - {"error":"No workspace filesystem configured"}');

    expect(isWorkspaceFilesystemUnavailableError(error)).toBe(true);
  });
});
