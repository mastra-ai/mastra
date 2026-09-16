import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import { WorkspaceFilesProvider } from '../../workspace-viewer/context/WorkspaceFilesProvider';
import { FactorySessionHeader } from '../components/RelatedFactorySessions';

const FACTORY_ID = 'factory-1';
const REPOSITORY_ID = 'repository-1';
const SESSION_ID = 'session-1';
const THREAD_ID = 'thread-1';

const workspaceSession = {
  id: 'workspace-row-1',
  sessionId: SESSION_ID,
  projectRepositoryId: REPOSITORY_ID,
  orgId: 'org-1',
  userId: 'user-1',
  branch: 'factory/issue-7',
  baseBranch: 'main',
  sandboxId: 'sandbox-1',
  sandboxWorkdir: '/workspaces/acme/app',
  materializedAt: '2026-07-29T00:00:00.000Z',
  createdAt: '2026-07-29T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
};

function workItem(url: string | undefined) {
  return {
    id: 'work-item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId: 'github-issue:7',
      ...(url ? { url } : {}),
    },
    parentWorkItemId: null,
    title: 'Fix sandbox setup',
    stages: ['execute'],
    stageHistory: [],
    sessions: {
      execute: {
        sessionId: SESSION_ID,
        branch: 'factory/issue-7',
        threadId: THREAD_ID,
        startedBy: 'user-1',
      },
    },
    metadata: { number: 7 },
    revision: 1,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
}

function linearWorkItem(url: string) {
  return {
    ...workItem(url),
    externalSource: {
      integrationId: 'linear',
      type: 'issue',
      externalId: 'linear-issue:ENG-123',
      url,
    },
    metadata: { identifier: 'ENG-123' },
  };
}

function stubHeader(item: ReturnType<typeof workItem> | ReturnType<typeof linearWorkItem>) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`, () =>
      HttpResponse.json({ session: workspaceSession }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPOSITORY_ID}/sessions`, () =>
      HttpResponse.json({ sessions: [workspaceSession] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [item] }),
    ),
  );
}

function renderHeader() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/workspaces/${SESSION_ID}/threads/${THREAD_ID}`]}>
      <MainSidebarProvider storageKey="related-factory-sessions-test">
        <Routes>
          <Route
            path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
            element={
              <WorkspaceFilesProvider>
                <FactorySessionHeader />
              </WorkspaceFilesProvider>
            }
          />
        </Routes>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('FactorySessionHeader', () => {
  describe('when the active work item has an external issue URL', () => {
    it('renders an issue pill that opens the external issue in a new tab', async () => {
      const issueUrl = 'https://github.com/acme/app/issues/7';
      stubHeader(workItem(issueUrl));
      renderHeader();

      const link = await screen.findByRole('link', { name: 'Open Issue #7' });

      expect(link).toHaveAttribute('href', issueUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link.querySelector('[data-source="github-issue"]')).toBeInTheDocument();
    });
  });

  describe('when the active work item is backed by a Linear issue', () => {
    it('renders a pill that opens the Linear issue in a new tab', async () => {
      const issueUrl = 'https://linear.app/acme/issue/ENG-123/fix-sandbox-setup';
      stubHeader(linearWorkItem(issueUrl));
      renderHeader();

      const link = await screen.findByRole('link', { name: 'Open ENG-123' });

      expect(link).toHaveAttribute('href', issueUrl);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link.querySelector('[data-source="linear-issue"]')).toBeInTheDocument();
    });
  });

  describe('when the active work item has no external URL', () => {
    it('does not render an external issue pill', async () => {
      stubHeader(workItem(undefined));
      renderHeader();

      expect(await screen.findByText('Issue #7: Fix sandbox setup')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Open Issue #7' })).not.toBeInTheDocument();
    });
  });
});
