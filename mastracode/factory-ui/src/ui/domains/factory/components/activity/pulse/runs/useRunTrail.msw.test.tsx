import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../../../../../e2e/ui/render';
import type { AuditEvent, AuditEventPage } from '../../../../services/audit';
import { useRunTrail } from './useRunTrail';

const FACTORY_ID = 'fp-1';
const HOUR_MS = 3_600_000;
const NOW_MS = Date.UTC(2026, 9, 21, 12);

function runStarted(kickoffId: string, hoursAgo: number): AuditEvent {
  return {
    id: `${kickoffId}-started`,
    actorId: 'user-1',
    actorType: 'human',
    action: 'factory.run.started',
    targets: [{ type: 'work_item', id: 'wi-1', name: 'Fix reconnect' }],
    metadata: { kickoffId, role: 'work', sessionId: `session-${kickoffId}` },
    occurredAt: new Date(NOW_MS - hoursAgo * HOUR_MS).toISOString(),
  };
}

const RUN_PAGES_BY_CURSOR: Record<string, AuditEventPage> = {
  '': { events: [runStarted('newest', 1)], nextCursor: 'older-1', actors: {} },
  'older-1': { events: [runStarted('older', 10)], nextCursor: 'older-2', actors: {} },
  'older-2': { events: [runStarted('oldest', 30)], actors: {} },
};

describe('run trail for a time window', () => {
  it('reads every older page a far-back view needs, one after another, and stops at the first run ever', async () => {
    const requestedCursors: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/:id/audit`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('before') ?? '';
        requestedCursors.push(cursor);
        return HttpResponse.json(RUN_PAGES_BY_CURSOR[cursor]);
      }),
    );

    const { result, client } = renderHookWithProviders(() =>
      useRunTrail({ factoryProjectId: FACTORY_ID, viewStartMs: NOW_MS - 48 * HOUR_MS, live: false }),
    );

    await waitFor(() => expect(result.current.trail?.historyComplete).toBe(true));
    await waitForMutationsIdle(client);
    expect(result.current.trail?.events.map(event => event.kickoffId)).toEqual(['newest', 'older', 'oldest']);
    expect(requestedCursors).toEqual(['', 'older-1', 'older-2']);
  });
});
