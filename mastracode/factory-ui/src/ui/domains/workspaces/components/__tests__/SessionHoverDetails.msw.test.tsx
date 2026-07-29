/**
 * BDD coverage for workspace sidebar previews. The real workspace, work-item,
 * and agent-controller reads are driven through MSW so the card exercises the
 * same joins used by the live sidebar without adding a hover-time request.
 */
import type { AgentControllerThreadInfo } from '@mastra/client-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { ChatSessionConfigProvider } from '../../../chat/context/ChatSessionProvider';
import type { FactoryUserSession } from '../../services/github';
import { WorkspacesSection } from '../WorkspacesSection';

const factoryId = 'fp-1';
const projectRepositoryId = 'ghp-1';
const workSessionId = 'session-work';
const reviewSessionId = 'session-review';
const workName = 'Investigate the authentication regression across long-running sessions';
const reviewName = 'Review the authentication refresh fix before release';

function workspace({ id, branch, updatedAt }: { id: string; branch: string; updatedAt: string }): FactoryUserSession {
  return {
    id: `row-${id}`,
    sessionId: id,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: updatedAt,
    updatedAt,
  };
}

function stubSessionDetails(updatedAt: string) {
  const workWorkspace = workspace({
    id: workSessionId,
    branch: 'factory/issue-42-authentication-regression',
    updatedAt,
  });
  const reviewWorkspace = workspace({
    id: reviewSessionId,
    branch: 'factory/pr-99-authentication-refresh',
    updatedAt,
  });
  const threads: AgentControllerThreadInfo[] = [
    {
      id: workSessionId,
      title: workName,
      resourceId: workSessionId,
      tags: { projectPath: workSessionId },
      state: 'active',
      createdAt: updatedAt,
      updatedAt,
    },
    {
      id: reviewSessionId,
      title: reviewName,
      resourceId: workSessionId,
      tags: { projectPath: reviewSessionId },
      state: 'idle',
      createdAt: updatedAt,
      updatedAt,
    },
  ];

  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: factoryId, name: 'Mastra' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/source-control-connections`, () =>
      HttpResponse.json({
        connections: [
          {
            id: 'connection-1',
            installationId: 'installation-1',
            repositories: [
              {
                id: projectRepositoryId,
                branch: 'main',
                sandboxWorkdir: '/workspace/mastra',
                repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
              },
            ],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/sessions`, () =>
      HttpResponse.json({ sessions: [workWorkspace, reviewWorkspace] }),
    ),
    http.get(`${TEST_BASE_URL}/web/user-sessions/${workSessionId}`, () =>
      HttpResponse.json({ session: workWorkspace }),
    ),
    http.post(`${TEST_BASE_URL}/web/github/projects/${projectRepositoryId}/ensure`, () =>
      HttpResponse.json({
        resourceId: workSessionId,
        factoryProjectId: factoryId,
        projectRepositoryId,
        sandboxId: 'sandbox-1',
        sandboxWorkdir: '/workspace/mastra',
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${factoryId}/work-items`, () =>
      HttpResponse.json({
        workItems: [
          {
            id: 'issue-42',
            orgId: 'org-1',
            createdBy: 'user-1',
            factoryProjectId: factoryId,
            externalSource: {
              integrationId: 'github',
              type: 'issue',
              externalId: '42',
              url: 'https://github.com/mastra-ai/mastra/issues/42',
            },
            parentWorkItemId: null,
            title: 'Authentication fails after token refresh',
            stages: ['execute'],
            stageHistory: [],
            sessions: {
              implementation: {
                sessionId: workSessionId,
                branch: workWorkspace.branch,
                threadId: workSessionId,
                startedBy: 'user-1',
              },
            },
            metadata: { number: 42 },
            revision: 1,
            createdAt: updatedAt,
            updatedAt,
          },
          {
            id: 'pr-99',
            orgId: 'org-1',
            createdBy: 'user-1',
            factoryProjectId: factoryId,
            externalSource: {
              integrationId: 'github',
              type: 'pull-request',
              externalId: '99',
              url: 'https://github.com/mastra-ai/mastra/pull/99',
            },
            parentWorkItemId: 'issue-42',
            title: 'Fix authentication refresh handling',
            stages: ['review'],
            stageHistory: [],
            sessions: {
              review: {
                sessionId: reviewSessionId,
                branch: reviewWorkspace.branch,
                threadId: reviewSessionId,
                startedBy: 'user-1',
              },
            },
            metadata: { number: 99 },
            revision: 1,
            createdAt: updatedAt,
            updatedAt,
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/api/agent-controller/code/sessions/${workSessionId}/threads`, () =>
      HttpResponse.json({ threads }),
    ),
  );
}

function renderSection() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/workspaces/${workSessionId}/threads/${workSessionId}`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/workspaces/:sessionId/threads/:threadId"
          element={
            <ChatSessionConfigProvider>
              <WorkspacesSection />
            </ChatSessionConfigProvider>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Workspace session hover details', () => {
  it('shows work and review metadata on hover or keyboard focus without taking over row actions', async () => {
    const updatedAt = new Date().toISOString();
    stubSessionDetails(updatedAt);
    const user = userEvent.setup();

    renderSection();

    const workRow = await screen.findByRole('button', { name: workName });
    const reviewRow = await screen.findByRole('button', { name: reviewName });
    expect(screen.queryByLabelText(`${workName} session details`)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(`${reviewName} session details`)).not.toBeInTheDocument();

    await user.hover(workRow);

    const workCard = await screen.findByLabelText(`${workName} session details`);
    expect(within(workCard).getByText(workName)).toBeInTheDocument();
    expect(within(workCard).getByText('Work session · Agent working')).toBeInTheDocument();
    expect(within(workCard).getByText('Work item: Issue #42')).toBeInTheDocument();
    expect(within(workCard).getByText('Authentication fails after token refresh')).toBeInTheDocument();
    expect(within(workCard).getByText('factory/issue-42-authentication-regression')).toBeInTheDocument();
    expect(within(workCard).getByText('main')).toBeInTheDocument();
    expect(within(workCard).getByText('just now')).toBeInTheDocument();
    expect(workRow).not.toHaveAttribute('title');

    await user.unhover(workRow);
    await waitFor(() => expect(screen.queryByLabelText(`${workName} session details`)).not.toBeInTheDocument());

    await user.tab();
    await user.tab();
    await user.tab();
    expect(reviewRow).toHaveFocus();

    const reviewCard = await screen.findByLabelText(`${reviewName} session details`);
    expect(within(reviewCard).getByText(reviewName)).toBeInTheDocument();
    expect(within(reviewCard).getByText('Review session')).toBeInTheDocument();
    expect(within(reviewCard).getByText('Review: PR #99')).toBeInTheDocument();
    expect(within(reviewCard).getByText('Fix authentication refresh handling')).toBeInTheDocument();
    expect(within(reviewCard).getByText('factory/pr-99-authentication-refresh')).toBeInTheDocument();
    expect(within(reviewCard).getByText('main')).toBeInTheDocument();
    expect(within(reviewCard).getByText('just now')).toBeInTheDocument();
    expect(reviewRow).not.toHaveAttribute('title');

    await user.tab();
    await waitFor(() => expect(screen.queryByLabelText(`${reviewName} session details`)).not.toBeInTheDocument());

    const reviewActions = screen.getByRole('button', { name: `Session actions for ${reviewName}` });
    await user.click(reviewActions);
    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });
});
