import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../commands/auth/client.js', () => ({
  createApiClient: vi.fn(token => ({ _token: token })),
}));

vi.mock('../commands/auth/credentials.js', () => ({
  getToken: vi.fn().mockResolvedValue('refreshed-token'),
}));

import { createApiClient } from '../commands/auth/client.js';
import { getToken } from '../commands/auth/credentials.js';
import { bestEffortCancel, confirmUploadWithRetry } from './deploy-upload.js';

const ok = () => Promise.resolve({ error: undefined, response: { status: 200 } });
const fail = (status: number) => Promise.resolve({ error: { detail: 'err' }, response: { status } });
const networkError = () =>
  Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }));

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());

// ─── bestEffortCancel ──────────────────────────────────────────────

describe('bestEffortCancel', () => {
  it('calls cancel and does not throw on success', async () => {
    const postCancel = vi.fn().mockImplementation(ok);
    await bestEffortCancel({ postCancel, client: {} as any, deployId: 'd1' });
    expect(postCancel).toHaveBeenCalledTimes(1);
  });

  it('swallows API-level cancel failure', async () => {
    const postCancel = vi.fn().mockImplementation(() => fail(404));
    await bestEffortCancel({ postCancel, client: {} as any, deployId: 'd1' });
    // no throw
  });

  it('swallows network exception on cancel', async () => {
    const postCancel = vi.fn().mockImplementation(networkError);
    await bestEffortCancel({ postCancel, client: {} as any, deployId: 'd1' });
    // no throw
  });
});

// ─── confirmUploadWithRetry ────────────────────────────────────────

describe('confirmUploadWithRetry', () => {
  const cancelDeploy = vi.fn();
  const baseOpts = () => ({
    cancelDeploy,
    client: { _token: 'initial' } as any,
    orgId: 'org-1',
    maxRetries: 2, // keep tests fast: 3 total attempts
  });

  it('returns immediately on first-attempt success', async () => {
    const post = vi.fn().mockImplementation(ok);
    await confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post });
    expect(post).toHaveBeenCalledTimes(1);
    expect(cancelDeploy).not.toHaveBeenCalled();
  });

  it('retries 5xx then succeeds', async () => {
    vi.useFakeTimers();
    const post = vi
      .fn()
      .mockImplementationOnce(() => fail(502))
      .mockImplementationOnce(ok);

    const p = confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post });
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(post).toHaveBeenCalledTimes(2);
    expect(cancelDeploy).not.toHaveBeenCalled();
  });

  it('retries network errors then succeeds', async () => {
    vi.useFakeTimers();
    const post = vi.fn().mockImplementationOnce(networkError).mockImplementationOnce(ok);

    const p = confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post });
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(post).toHaveBeenCalledTimes(2);
  });

  it('refreshes token on 401 before retry', async () => {
    vi.useFakeTimers();
    vi.mocked(getToken).mockResolvedValue('fresh-tok');
    vi.mocked(createApiClient).mockReturnValue({ _token: 'fresh' } as any);

    const post = vi
      .fn()
      .mockImplementationOnce(() => fail(401))
      .mockImplementationOnce(ok);

    const p = confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post });
    // Flush microtasks so the first attempt completes before advancing timers
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(createApiClient).toHaveBeenCalledWith('fresh-tok', 'org-1');
    // Second call uses refreshed client
    expect(post.mock.calls[1]![0]).toEqual({ _token: 'fresh' });
  });

  it('does NOT retry 4xx other than 401', async () => {
    const post = vi.fn().mockImplementation(() => fail(404));

    await expect(confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post })).rejects.toThrow(
      'Upload confirmation failed: 404',
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(cancelDeploy).toHaveBeenCalledTimes(1);
  });

  it('cancels deploy and throws after retries exhausted', async () => {
    const post = vi.fn().mockImplementation(() => fail(500));

    await expect(confirmUploadWithRetry({ ...baseOpts(), maxRetries: 0, postUploadComplete: post })).rejects.toThrow(
      'Upload confirmation failed: 500',
    );

    expect(post).toHaveBeenCalledTimes(1);
    expect(cancelDeploy).toHaveBeenCalledTimes(1);
  });

  it('cancels and throws when token refresh fails', async () => {
    vi.mocked(getToken).mockRejectedValue(new Error('no refresh token'));
    const post = vi.fn().mockImplementation(() => fail(401));

    await expect(confirmUploadWithRetry({ ...baseOpts(), maxRetries: 1, postUploadComplete: post })).rejects.toThrow(
      'no refresh token',
    );

    expect(cancelDeploy).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
