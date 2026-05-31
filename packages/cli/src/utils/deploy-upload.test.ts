import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../commands/auth/client.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    createApiClient: vi.fn((token: string, orgId: string) => ({ _token: token, _orgId: orgId })),
  };
});

vi.mock('../commands/auth/credentials.js', () => ({
  getToken: vi.fn().mockResolvedValue('refreshed-token'),
}));
import { bestEffortCancel, confirmUploadWithRetry, uploadArtifactWithRetry } from './deploy-upload.js';

const ok = () => Promise.resolve({ error: undefined, response: { status: 200 } });
const fail = (status: number) => Promise.resolve({ error: { detail: 'err' }, response: { status } });
/** API error without RFC7807 `detail` — exercises status-only fallback messages */
const httpErrorNoMessage = (status: number) => Promise.resolve({ error: { status }, response: { status } });
const networkError = () =>
  Promise.reject(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }));

beforeEach(() => vi.clearAllMocks());
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
    const refreshClient = vi.fn().mockResolvedValue({ _token: 'fresh' } as any);

    const post = vi
      .fn()
      .mockImplementationOnce(() => fail(401))
      .mockImplementationOnce(ok);

    const p = confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post, refreshClient });
    // Flush microtasks so the first attempt completes before advancing timers
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    await p;

    expect(refreshClient).toHaveBeenCalledTimes(1);
    expect(refreshClient).toHaveBeenCalledWith('org-1');
    // Second call uses refreshed client
    expect(post.mock.calls[1]![0]).toEqual({ _token: 'fresh' });
  });

  it('does NOT retry 4xx other than 401', async () => {
    const post = vi.fn().mockImplementation(() => httpErrorNoMessage(404));

    await expect(confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post })).rejects.toThrow(
      'Upload confirmation failed: 404',
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(cancelDeploy).toHaveBeenCalledTimes(1);
  });

  it('surfaces platform error detail on 402 from upload-complete', async () => {
    const post = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ error: { detail: 'Payment required to deploy' }, response: { status: 402 } }),
      );

    await expect(confirmUploadWithRetry({ ...baseOpts(), postUploadComplete: post })).rejects.toThrow(
      'Payment required to deploy',
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(cancelDeploy).toHaveBeenCalledTimes(1);
  });

  it('cancels deploy and throws after retries exhausted', async () => {
    const post = vi.fn().mockImplementation(() => httpErrorNoMessage(500));

    await expect(confirmUploadWithRetry({ ...baseOpts(), maxRetries: 0, postUploadComplete: post })).rejects.toThrow(
      'Upload confirmation failed: 500',
    );

    expect(post).toHaveBeenCalledTimes(1);
    expect(cancelDeploy).toHaveBeenCalledTimes(1);
  });

  it('cancels and throws when token refresh fails', async () => {
    const refreshClient = vi.fn().mockRejectedValue(new Error('no refresh token'));
    const post = vi.fn().mockImplementation(() => fail(401));

    await expect(
      confirmUploadWithRetry({ ...baseOpts(), maxRetries: 1, postUploadComplete: post, refreshClient }),
    ).rejects.toThrow('no refresh token');

    expect(cancelDeploy).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });
});

// ─── uploadArtifactWithRetry ───────────────────────────────────────

describe('uploadArtifactWithRetry', () => {
  it('uploads zip data with content length', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    await uploadArtifactWithRetry({
      uploadUrl: 'https://signed.example/upload',
      zipBuffer: Buffer.from('zip'),
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://signed.example/upload',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          'Content-Type': 'application/zip',
          'Content-Length': '3',
        }),
      }),
    );
  });

  it('retries transient upload failures and recovers', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const upload = uploadArtifactWithRetry({
      uploadUrl: 'https://signed.example/upload',
      zipBuffer: Buffer.from('zip'),
      fetchImpl,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await upload;

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('surfaces non-200 response diagnostics without retrying non-retryable status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('signature mismatch', {
        status: 403,
        statusText: 'Forbidden',
        headers: { 'x-request-id': 'req-123' },
      }),
    );

    await expect(
      uploadArtifactWithRetry({
        uploadUrl: 'https://signed.example/upload',
        zipBuffer: Buffer.from('zip'),
        fetchImpl,
      }),
    ).rejects.toThrow(
      /endpoint=https:\/\/signed.example\/upload; status=403 Forbidden; body=signature mismatch; requestId=req-123/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries retryable upload responses before failing with response body', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('try again later', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'x-amz-request-id': 'amz-123' },
      }),
    );

    const upload = uploadArtifactWithRetry({
      uploadUrl: 'https://signed.example/upload',
      zipBuffer: Buffer.from('zip'),
      fetchImpl,
      maxRetries: 1,
    });
    const rejection = expect(upload).rejects.toThrow(
      /status=503 Service Unavailable; body=try again later; requestId=amz-123/,
    );

    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('aborts timed-out uploads and includes timeout diagnostics', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const abortError = new Error('This operation was aborted');
          abortError.name = 'AbortError';
          reject(abortError);
        });
      });
    });

    const upload = uploadArtifactWithRetry({
      uploadUrl: 'https://signed.example/upload',
      zipBuffer: Buffer.from('zip'),
      fetchImpl,
      timeoutMs: 25,
      maxRetries: 0,
    });

    await vi.advanceTimersByTimeAsync(25);
    await expect(upload).rejects.toMatchObject({
      endpoint: 'https://signed.example/upload',
      timedOut: true,
      timeoutMs: 25,
    });
  });
});
