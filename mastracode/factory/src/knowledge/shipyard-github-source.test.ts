import { describe, expect, it, vi } from 'vitest';
import { createShipyardGitHubSource } from './shipyard-github-source.js';

const since = '2026-09-01T00:00:00Z';
const mergedAt = '2026-09-02T00:00:00Z';
const signal = new AbortController().signal;
const pull = { number: 12, title: 'Verified behavior', body: 'Evidence', merged_at: mergedAt, merge_commit_sha: 'abc' };

function harness() {
  const request = vi.fn<typeof fetch>();
  const source = createShipyardGitHubSource({
    repository: 'mastra-ai/mastra',
    since,
    token: 'test-token',
    fetch: request,
  });
  return { source, request };
}

describe('Shipyard GitHub source', () => {
  it('reads and reverifies bounded merged revisions, carries an inclusive watermark and rejects changed evidence', async () => {
    const { source, request } = harness();
    request.mockResolvedValueOnce(
      Response.json({ total_count: 1, incomplete_results: false, items: [{ number: 12 }] }),
    );
    request.mockResolvedValueOnce(Response.json(pull));
    const window = await source.readWindow(undefined, signal);
    expect(window.watermark).toBe(mergedAt);
    expect(window.entries).toHaveLength(1);
    request.mockResolvedValueOnce(Response.json(pull));
    expect(await source.verify(window.entries[0]!, signal)).toBe(true);
    request.mockResolvedValueOnce(Response.json({ ...pull, body: 'Changed after read' }));
    expect(await source.verify(window.entries[0]!, signal)).toBe(false);
    request.mockResolvedValueOnce(Response.json({ total_count: 0, incomplete_results: false, items: [] }));
    expect(await source.readWindow(window.watermark, signal)).toEqual({ watermark: mergedAt, entries: [] });
    expect(decodeURIComponent(String(request.mock.calls[4]![0]))).toContain(`merged:>=${mergedAt}`);
    expect(request.mock.calls[0]![1]).toMatchObject({ signal, redirect: 'error' });
  });

  it.each([
    { total_count: 21, incomplete_results: false, items: [] },
    { total_count: 1, incomplete_results: true, items: [{ number: 12 }] },
    { total_count: 2, incomplete_results: false, items: [{ number: 12 }] },
  ])('fails closed on an incomplete search window', async result => {
    const { source, request } = harness();
    request.mockResolvedValueOnce(Response.json(result));
    await expect(source.readWindow(undefined, signal)).rejects.toThrow('window is incomplete');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects forged source identity without making a request and sanitizes upstream failures', async () => {
    const { source, request } = harness();
    expect(
      await source.verify(
        {
          address: 'github:private/repo:pr:12',
          name: 'Forged',
          revision: 'x',
          text: 'x',
          citation: 'https://github.com/mastra-ai/mastra/pull/12',
        },
        signal,
      ),
    ).toBe(false);
    expect(request).not.toHaveBeenCalled();
    request.mockResolvedValueOnce(new Response('secret upstream body', { status: 403 }));
    await expect(source.readWindow(undefined, signal)).rejects.toThrow('GitHub source request failed (403)');
  });
});
