import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

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

let threadRequests: string[] = [];
beforeEach(() => {
  threadRequests = [];
});

/** The default list carries `items`; `closed` cards only answer a `?threadId` read, as on the server. */
function stubBoard(items: ReturnType<typeof wireItem>[], closed: ReturnType<typeof wireItem>[] = []) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, ({ request }) => {
      const threadId = new URL(request.url).searchParams.get('threadId');
      if (threadId === null) return HttpResponse.json({ workItems: items, runningSessionIds: [] });
      threadRequests.push(threadId);
      const onThread = [...items, ...closed].filter(card =>
        Object.values(card.sessions).some(ref => ref.threadId === threadId),
      );
      return HttpResponse.json({ workItems: onThread, runningSessionIds: [] });
    }),
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
    // A miss asks the server by thread once; nothing closed carries the thread either.
    await waitFor(() => expect(threadRequests).toEqual(['thread-1']));
  });

  it('falls back to the thread read when the board snapshot omits a closed card', async () => {
    const done = { ...wireItem('item-done', { work: sessionRef('thread-1', 'session-done') }), stages: ['done'] };
    stubBoard([wireItem('item-a', { work: sessionRef('thread-other', 'session-a') })], [done]);

    const { result } = renderHookWithProviders(() => useThreadWorkItem(PROJECT_ID, 'thread-1', 'session-done'));
    await waitFor(() => expect(result.current.data?.id).toBe('item-done'));
    expect(result.current.data?.stages).toEqual(['done']);
    expect(threadRequests).toEqual(['thread-1']);
  });

  it('does not read by thread while the board snapshot still carries the card', async () => {
    stubBoard([wireItem('item-b', { work: sessionRef('thread-1', 'session-b') })]);

    const { result } = renderHookWithProviders(() => useThreadWorkItem(PROJECT_ID, 'thread-1'));
    await waitFor(() => expect(result.current.data?.id).toBe('item-b'));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(threadRequests).toEqual([]);
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
