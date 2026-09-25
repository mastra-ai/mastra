import { describe, expect, it, vi } from 'vitest';
import { Workflow } from './workflow';

describe('Workflow.runSummaries', () => {
  it('fetches the summary endpoint with pagination and status filters', async () => {
    const response = { runs: [{ workflowName: 'wf-1', runId: 'run-1', status: 'success', timestamp: 123 }], total: 1 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal('fetch', fetchMock);
    const workflow = new Workflow({ baseUrl: 'http://localhost:4111', retries: 0 }, 'wf-1');
    expect(await workflow.runSummaries({ limit: 20, offset: 20, status: 'success' })).toEqual(response);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:4111/api/workflows/wf-1/run-summaries?limit=20&offset=20&status=success',
    );
    vi.unstubAllGlobals();
  });
});
