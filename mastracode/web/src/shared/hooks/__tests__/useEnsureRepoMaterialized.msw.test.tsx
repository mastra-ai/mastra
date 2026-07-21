/**
 * BDD coverage for the sandbox materialization mutation hook.
 *
 * Drives the real `ensureRepoMaterialized` SSE service + React Query mutation;
 * only the network is mocked (MSW). SSE responses are emitted as
 * `text/event-stream` bodies that the service's `readSSE` parses for real.
 */
import { act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { MaterializeResult, PrepareProgress } from '../../../web/ui/domains/workspaces/services/github';
import { useEnsureRepoMaterializedMutation } from '../useEnsureRepoMaterialized';

const ORIGIN = TEST_BASE_URL;
const ENSURE_URL = `${ORIGIN}/web/github/projects/ghp_1/ensure`;

const materialized: MaterializeResult = {
  resourceId: 'resource-1',
  factoryProjectId: 'factory-project-1',
  projectRepositoryId: 'ghp_1',
  sandboxId: 'sbx_1',
  sandboxWorkdir: '/workspace/repo',
};

const progressEvents: PrepareProgress[] = [
  { phase: 'provisioning', message: 'Provisioning sandbox…' },
  { phase: 'cloning', message: 'Cloning repository…' },
  { phase: 'done', message: 'Ready' },
];

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseResponse(body: string) {
  return new HttpResponse(body, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('useEnsureRepoMaterializedMutation', () => {
  it('given the server streams SSE, when the mutation runs, then onProgress sees each phase in order and the result resolves', async () => {
    const body = progressEvents.map(event => sseFrame('progress', event)).join('') + sseFrame('done', materialized);
    server.use(http.post(ENSURE_URL, () => sseResponse(body)));

    const onProgress = vi.fn();
    const { result, client } = renderHookWithProviders(() => useEnsureRepoMaterializedMutation());

    let resolved: MaterializeResult | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ projectRepositoryId: 'ghp_1', onProgress });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(materialized);
    expect(onProgress.mock.calls.map(([event]) => event)).toEqual(progressEvents);
  });

  it('given the server falls back to a single JSON body, when the mutation runs, then the result still resolves', async () => {
    server.use(http.post(ENSURE_URL, () => HttpResponse.json(materialized)));

    const { result, client } = renderHookWithProviders(() => useEnsureRepoMaterializedMutation());

    let resolved: MaterializeResult | undefined;
    await act(async () => {
      resolved = await result.current.mutateAsync({ projectRepositoryId: 'ghp_1' });
    });
    await waitForMutationsIdle(client);

    expect(resolved).toEqual(materialized);
  });

  it('given the sandbox is not configured, when the server responds 503 JSON, then the mutation error carries that code', async () => {
    server.use(
      http.post(ENSURE_URL, () =>
        HttpResponse.json({ error: 'sandbox_not_configured', message: 'Sandbox is not configured' }, { status: 503 }),
      ),
    );

    const { result, client } = renderHookWithProviders(() => useEnsureRepoMaterializedMutation());

    await act(async () => {
      await expect(result.current.mutateAsync({ projectRepositoryId: 'ghp_1' })).rejects.toMatchObject({
        message: 'Sandbox is not configured',
        code: 'sandbox_not_configured',
      });
    });
    await waitForMutationsIdle(client);

    expect((result.current.error as Error & { code?: string })?.code).toBe('sandbox_not_configured');
  });

  it('given the stream fails mid-way, when the server emits an SSE error event, then the mutation rejects with its code', async () => {
    const body =
      sseFrame('progress', progressEvents[0]) +
      sseFrame('error', { error: 'clone_failed', message: 'Clone failed inside the sandbox' });
    server.use(http.post(ENSURE_URL, () => sseResponse(body)));

    const onProgress = vi.fn();
    const { result, client } = renderHookWithProviders(() => useEnsureRepoMaterializedMutation());

    await act(async () => {
      await expect(result.current.mutateAsync({ projectRepositoryId: 'ghp_1', onProgress })).rejects.toMatchObject({
        message: 'Clone failed inside the sandbox',
        code: 'clone_failed',
      });
    });
    await waitForMutationsIdle(client);

    expect(onProgress).toHaveBeenCalledWith(progressEvents[0]);
  });
});
