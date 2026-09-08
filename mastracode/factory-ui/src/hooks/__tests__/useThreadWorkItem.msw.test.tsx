import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { WorkItemSessionRef } from '../../ui/domains/factory/services/workItems';
import { useThreadWorkItem } from '../useThreadWorkItem';

const PROJECT_ID = 'project-1';

function sessionRef(threadId: string, sessionId: string): WorkItemSessionRef {
  return { sessionId, branch: 'main', threadId, startedBy: 'user-1' };
}

function wireItem(id: string, sessions: Record<string, WorkItemSessionRef>) {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: PROJECT_ID,
    externalSource: null,
    parentWorkItemId: null,
    title: `Card ${id}`,
    stages: ['execute'],
    stageHistory: [],
    sessions,
    metadata: {},
    revision: 1,
    createdAt: '2026-08-26T00:00:00.000Z',
    updatedAt: '2026-08-26T00:00:00.000Z',
  };
}

function stubBoard(items: ReturnType<typeof wireItem>[]) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
      HttpResponse.json({ workItems: items, runningSessionIds: [] }),
    ),
  );
}

describe('useThreadWorkItem', () => {
  it('finds the card whose session runs the thread', async () => {
    stubBoard([
      wireItem('item-a', { work: sessionRef('thread-other', 'session-a') }),
      wireItem('item-b', { work: sessionRef('thread-1', 'session-b') }),
    ]);

    const { result } = renderHookWithProviders(() => useThreadWorkItem(PROJECT_ID, 'thread-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('item-b');
  });

  it('breaks a thread tie with the session id', async () => {
    stubBoard([
      wireItem('item-a', { work: sessionRef('thread-1', 'session-a') }),
      wireItem('item-b', { review: sessionRef('thread-1', 'session-b') }),
    ]);

    const { result } = renderHookWithProviders(() => useThreadWorkItem(PROJECT_ID, 'thread-1', 'session-b'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('item-b');
  });

  it('resolves to nothing when no card references the thread', async () => {
    stubBoard([wireItem('item-a', {})]);

    const { result } = renderHookWithProviders(() => useThreadWorkItem(PROJECT_ID, 'thread-1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('stays pending without a project id and makes no request', async () => {
    let requests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () => {
        requests += 1;
        return HttpResponse.json({ workItems: [], runningSessionIds: [] });
      }),
    );

    const { result } = renderHookWithProviders(() => useThreadWorkItem(undefined, 'thread-1'));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(result.current.isPending).toBe(true);
    expect(requests).toBe(0);
  });
});
