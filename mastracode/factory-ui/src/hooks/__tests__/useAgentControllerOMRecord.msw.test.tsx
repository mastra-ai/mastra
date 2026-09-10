import type { AgentControllerOMRecord } from '@mastra/client-js';
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { useAgentControllerOMRecord } from '../useAgentControllerOMRecord';

const controllerId = 'code';
const resourceId = 'resource-test';
const omUrl = `${TEST_BASE_URL}/api/agent-controller/${controllerId}/sessions/${resourceId}/om`;

function buildRecord(overrides: Partial<AgentControllerOMRecord> = {}): AgentControllerOMRecord {
  return {
    id: 'record-1',
    scope: 'thread',
    resourceId,
    threadId: 'thread-1',
    activeObservations: '<observations>committed facts</observations>',
    originType: 'observation',
    generationCount: 1,
    totalTokensObserved: 100,
    observationTokenCount: 40,
    pendingMessageTokens: 0,
    isObserving: false,
    isReflecting: false,
    config: {},
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    ...overrides,
  } as AgentControllerOMRecord;
}

describe('useAgentControllerOMRecord', () => {
  it('returns the persisted record including buffered content', async () => {
    server.use(
      http.get(omUrl, () =>
        HttpResponse.json({
          record: buildRecord({
            bufferedObservationChunks: [
              { cycleId: 'cycle-1', observations: 'not yet activated', tokenCount: 8, messageTokens: 16 },
            ],
            bufferedReflection: 'pending reflection',
          }),
        }),
      ),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerOMRecord({
        agentControllerId: controllerId,
        resourceId,
        baseUrl: TEST_BASE_URL,
        enabled: true,
      }),
    );

    await waitFor(() => expect(result.current.data?.activeObservations).toContain('committed facts'));
    expect(result.current.data?.bufferedObservationChunks?.[0]?.observations).toBe('not yet activated');
    expect(result.current.data?.bufferedReflection).toBe('pending reflection');
  });

  it('does not request the record while disabled', async () => {
    const onRead = vi.fn();
    server.use(
      http.get(omUrl, () => {
        onRead();
        return HttpResponse.json({ record: buildRecord() });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerOMRecord({
        agentControllerId: controllerId,
        resourceId,
        baseUrl: TEST_BASE_URL,
        enabled: false,
      }),
    );

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(onRead).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('re-reads the record while the agent is still observing', async () => {
    const onRead = vi.fn();
    let observations = 'first pass';
    server.use(
      http.get(omUrl, () => {
        onRead();
        return HttpResponse.json({ record: buildRecord({ activeObservations: observations, isObserving: true }) });
      }),
    );

    const { result } = renderHookWithProviders(() =>
      useAgentControllerOMRecord({
        agentControllerId: controllerId,
        resourceId,
        baseUrl: TEST_BASE_URL,
        enabled: true,
        active: true,
      }),
    );

    await waitFor(() => expect(result.current.data?.activeObservations).toBe('first pass'));

    observations = 'second pass';

    await waitFor(() => expect(result.current.data?.activeObservations).toBe('second pass'), { timeout: 8000 });
    expect(onRead.mock.calls.length).toBeGreaterThan(1);
  });
});
