import { useQuery } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PullRequestSubscription, WorkItem } from '@internal/factory-contract';
import { PageTitle } from '@mastra/playground-ui/domains/factory/session/thread/chat/components/PageTitle';
import { ChatSessionActionsContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatSessionActionsContext';
import type { ChatSessionActionsApi } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatSessionActionsContext';
import { ChatSessionContext } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatSessionContext';
import type { ChatSessionContextApi } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/ChatSessionContext';
import {
  SessionHostContext,
  useSessionHost,
} from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';
import type { SessionHostData } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';
import { renderHookWithProviders, renderWithProviders } from '../../../../../../e2e/ui/render';
import { useThreadSubscriptions } from '../../hooks/useThreadSubscriptions';

const THREAD_ID = 'thread-1';
const THREADS = { list: [{ id: THREAD_ID, title: 'Fix login' }] };

const ACTIONS: ChatSessionActionsApi = {
  send: async () => undefined,
  sending: false,
  abort: async () => undefined,
  approveTool: async () => undefined,
  respondToSuspension: async () => undefined,
  replying: false,
  createThread: async () => ({ id: 'thread-2' }),
  switchingThread: false,
};

const SESSION: ChatSessionContextApi = {
  sessionId: 'session-1',
  resourceId: 'resource-1',
  sessionEnabled: true,
  resourceReady: true,
  sandboxReady: true,
  sandboxPreparing: false,
  resourceEnabled: true,
  baseUrl: 'http://localhost:4111',
  kind: 'factory',
};

const CARD: WorkItem = {
  id: 'card-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: 'fp-1',
  board: 'work',
  source: 'linear-issue',
  sourceKey: 'linear:ENG-123',
  parentWorkItemId: null,
  title: 'Login fails',
  url: null,
  stages: ['queued'],
  stageHistory: [],
  sessions: {},
  metadata: {},
  triageType: null,
  acceptedAt: null,
  description: null,
  revision: 1,
  createdAt: '2026-09-08T12:00:00Z',
  updatedAt: '2026-09-08T12:00:00Z',
};

const SUBSCRIPTION: PullRequestSubscription = {
  id: 'sub-1',
  repoFullName: 'mastra-ai/mastra',
  pullRequestNumber: 7,
  status: 'open',
  url: 'https://github.com/mastra-ai/mastra/pull/7',
};

type OptionalData = Partial<Pick<SessionHostData, 'useSessionCard' | 'pullRequestSubscriptions'>>;

/** Re-provides the session host and actions with only the given optional capabilities. */
function Host({
  data,
  threads,
  children,
}: {
  data: OptionalData;
  threads?: ChatSessionActionsApi['threads'];
  children: ReactNode;
}) {
  const host = useSessionHost();
  const { useSessionCard: _card, pullRequestSubscriptions: _subscriptions, ...required } = host.data;
  return (
    <SessionHostContext.Provider value={{ ...host, threadId: THREAD_ID, data: { ...required, ...data } }}>
      <ChatSessionContext.Provider value={SESSION}>
        <ChatSessionActionsContext.Provider value={{ ...ACTIONS, threads }}>
          {children}
        </ChatSessionActionsContext.Provider>
      </ChatSessionContext.Provider>
    </SessionHostContext.Provider>
  );
}

function useSubscriptionsQuery() {
  return useQuery({ queryKey: ['test-subscriptions'], queryFn: async () => [SUBSCRIPTION] });
}

function renderTitle(data: OptionalData, threads?: ChatSessionActionsApi['threads']) {
  return renderWithProviders(
    <Host data={data} threads={threads}>
      <PageTitle />
    </Host>,
  );
}

function renderSubscriptions(data: OptionalData) {
  return renderHookWithProviders(() => useThreadSubscriptions(THREAD_ID, true), {
    inner: ({ children }) => <Host data={data}>{children}</Host>,
  });
}

afterEach(() => {
  document.title = '';
});

describe('Session host without optional capabilities', () => {
  it('titles the tab from the thread list when the host has threads', async () => {
    renderTitle({}, THREADS);
    await waitFor(() => expect(document.title).toBe('Fix login | Mastra Factory'));
  });

  it('keeps the default tab title when the host has no threads', () => {
    renderTitle({});
    expect(document.title).toBe('Mastra Factory');
  });

  it('titles the tab from the card when the host has one', async () => {
    renderTitle({ useSessionCard: () => ({ item: CARD }) }, THREADS);
    await waitFor(() => expect(document.title).toBe('ENG-123 | Mastra Factory'));
  });

  it('falls back to the thread title when the host has no card', async () => {
    renderTitle({}, THREADS);
    await waitFor(() => expect(document.title).toBe('Fix login | Mastra Factory'));
  });

  it('reads pull-request subscriptions when the host has them', async () => {
    const { result } = renderSubscriptions({
      pullRequestSubscriptions: { use: useSubscriptionsQuery, invalidate: () => {} },
    });
    await waitFor(() => expect(result.current.subscriptions).toEqual([SUBSCRIPTION]));
  });

  it('reports no pull-request subscriptions when the host has none', () => {
    const { result } = renderSubscriptions({});
    expect(result.current).toEqual({ subscriptions: [], pending: false, failed: false });
  });
});
