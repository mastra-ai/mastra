import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { stubSessionsFactory } from '../../../workspaces/components/__tests__/fixtures/sessionsSection';
import type { TimelineEntry } from '../../services/transcript';
import { TranscriptEntries } from '../Transcript';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';
const CREATED_AT = '2026-10-23T10:00:00.000Z';
const TEXT = 'Side sessions you started:\n- "Live review" (session side-live): running';

function liveSession(sessionId: string, title: string) {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    visibility: 'org',
    title,
    branch: `factory/${sessionId}`,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: CREATED_AT,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

const followedItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'user-1',
  factoryProjectId: factoryId,
  board: 'work',
  externalSource: { integrationId: 'github', type: 'issue', externalId: '42' },
  parentWorkItemId: null,
  title: 'Fix flaky login',
  stages: ['execute'],
  stageHistory: [],
  sessions: { work: { sessionId: 'worker-1', branch: 'factory/issue-42', threadId: 'worker-1', startedBy: 'user-1' } },
  metadata: {},
  revision: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

function sessionsSignal(value: Record<string, unknown> | undefined): TimelineEntry {
  const id = 'signal-sessions';
  const message: MastraDBMessage = {
    id,
    role: 'signal',
    createdAt: new Date(CREATED_AT),
    content: {
      format: 2,
      parts: [{ type: 'text', text: TEXT }],
      metadata: {
        signal: {
          id,
          type: 'state',
          tagName: 'factory-sessions',
          createdAt: CREATED_AT,
          attributes: { sideSessions: 2, following: 1 },
          metadata: {
            state: { id: 'factory-sessions', cacheKey: 'sessions:abc', mode: 'snapshot' },
            ...(value ? { value } : {}),
          },
        },
      },
    },
  };
  return { kind: 'message', id, message };
}

const snapshot = {
  sessions: {
    sideSessions: [
      { sessionId: 'side-live', title: 'Live review', state: 'running', lastReport: null, muted: false },
      { sessionId: 'side-gone', title: 'Gone session', state: 'running', lastReport: null, muted: false },
    ],
    following: [
      {
        workItemId: 'item-1',
        label: 'Issue #42',
        title: 'Fix flaky login',
        stage: 'execute',
        worker: { role: 'work', sessionId: 'worker-1', state: 'parked', quietSince: null },
        lastReport: null,
      },
    ],
    more: 3,
  },
};

function renderSignal(entry: TimelineEntry) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/workspaces/origin-1/threads/origin-1`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={<TranscriptEntries entries={[entry]} onApprove={() => {}} onRespond={() => {}} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  stubSessionsFactory(factoryId, [projectRepositoryId]);
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [liveSession('side-live', 'Live review')] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({ workItems: [followedItem] }),
    ),
  );
});

describe('factory-sessions signal', () => {
  it('renders side sessions as sidebar session rows linking to each session', async () => {
    renderSignal(sessionsSignal(snapshot));

    const group = screen.getByRole('group', { name: 'Signal: factory-sessions' });
    expect(group).toHaveAttribute('data-signal-kind', 'state');
    expect(within(group).getByText('2 side sessions · 1 followed work item · +3 more')).toBeInTheDocument();
    expect(within(group).getByText('+3 more')).toBeInTheDocument();
    expect(within(group).queryByText(/Side sessions you started/)).not.toBeInTheDocument();

    const sideSessions = within(group).getByRole('region', { name: 'Side sessions' });
    const gone = within(sideSessions).getByRole('link', { name: 'Gone session' });
    expect(gone).toHaveAttribute('href', `/factories/${factoryId}/workspaces/side-gone/threads/side-gone`);
    expect(within(sideSessions).getByRole('status', { name: 'Agent working in Gone session' })).toBeInTheDocument();

    // Until the session list loads the row shows the snapshot state; the live row then reports no active run.
    await waitFor(() =>
      expect(
        within(sideSessions).queryByRole('status', { name: 'Agent working in Live review' }),
      ).not.toBeInTheDocument(),
    );
    const live = within(sideSessions).getByRole('link', { name: 'Live review' });
    expect(live).toHaveAttribute('href', `/factories/${factoryId}/workspaces/side-live/threads/side-live`);
  });

  it('renders followed work items with the work item link and their stage', async () => {
    renderSignal(sessionsSignal(snapshot));

    const followed = screen.getByRole('region', { name: 'Followed work items' });
    expect(within(followed).getByText('execute · worker waiting')).toBeInTheDocument();
    const link = await within(followed).findByRole('link', { name: /Open live session for/ });
    expect(link).toHaveAttribute('href', `/factories/${factoryId}/workspaces/worker-1/threads/worker-1`);
  });

  it('keeps the plain text row when the snapshot has no structured sessions', async () => {
    renderSignal(sessionsSignal(undefined));

    const group = screen.getByRole('group', { name: 'Signal: factory-sessions' });
    expect(within(group).getByText(/Side sessions you started/)).toBeInTheDocument();
    expect(within(group).queryByRole('region', { name: 'Side sessions' })).not.toBeInTheDocument();
  });
});
