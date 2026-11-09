/**
 * A card whose latest move sent it back to an earlier phase says so on its
 * face, with why: self-review's findings when self-review asked for changes,
 * else the agent's rationale from the move's audit event. Its details hold the
 * whole reason.
 */
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { workBoardCatalog } from '../../../e2e/ui/board-catalog';
import { listedRepository } from '../../../e2e/ui/factory-projects';
import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { createQueryClient } from '../../query-client';
import type { AuditEvent, AuditEventPage } from '../domains/factory/services/audit';
import type { WorkItem } from '../domains/factory/services/workItems';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const REPO_ID = 'repo-1';

const FINDINGS = [
  '- The retry loop never backs off, so a flaky API is hammered.',
  '- `loadPage` has no test for an empty page.',
].join('\n');
const RATIONALE = 'The plan misses the session table migration; replanning before building.';

/** A work item as the server sends it: the client maps the project id and source onto `WorkItem`. */
type WireWorkItem = Omit<WorkItem, 'githubProjectId' | 'source' | 'sourceKey' | 'url'> & {
  factoryProjectId: string;
  externalSource: { integrationId: string; type: string; externalId: string } | null;
};

function card(id: string, issue: number, title: string, stage: string, metadata: Record<string, unknown> = {}) {
  const item: WireWorkItem = {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    factoryProjectId: FACTORY_ID,
    externalSource: { integrationId: 'github', type: 'issue', externalId: `github-issue:${issue}` },
    triageType: null,
    acceptedAt: null,
    board: 'work',
    parentWorkItemId: null,
    title,
    stages: [stage],
    stageHistory: [],
    sessions: {},
    metadata,
    commentCount: 0,
    revision: 5,
    createdAt: '2026-11-06T08:00:00.000Z',
    updatedAt: '2026-11-06T10:00:00.000Z',
  };
  return item;
}

function stageMoved(itemId: string, from: string, to: string, cause: string, occurredAt: string): AuditEvent {
  return {
    id: `moved-${itemId}-${to}`,
    actorId: 'agent:work',
    actorType: 'agent',
    action: 'factory.work_item.stage_moved',
    targets: [{ type: 'work_item', id: itemId }],
    metadata: { from, to, cause, revision: 5 },
    occurredAt,
  };
}

const sentBackBySelfReview = card('item-1', 1, 'Fix login bug', 'execute', {
  selfReviewVerdict: 'request changes',
  selfReviewFindings: FINDINGS,
  selfReviewRounds: 1,
});
const replanned = card('item-2', 2, 'Add session table', 'planning');

const audit: AuditEventPage = {
  events: [
    stageMoved(
      'item-1',
      'review',
      'execute',
      'Self-review requested changes on abc123 (round 1).',
      '2026-11-06T10:00:00.000Z',
    ),
    stageMoved('item-2', 'execute', 'planning', RATIONALE, '2026-11-06T09:30:00.000Z'),
  ],
  actors: {},
};

function stubWorkBoard() {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({
        projects: [
          {
            id: FACTORY_ID,
            name: 'Acme Factory',
            repositories: [listedRepository(REPO_ID, 'acme/app', { branch: 'main', sandboxWorkdir: '/repo' })],
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/boards`, () => HttpResponse.json(workBoardCatalog)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [sentBackBySelfReview, replanned] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/audit`, () => HttpResponse.json(audit)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/sessions`, () => HttpResponse.json({ sessions: [] })),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: { github: { enabled: true, sourceIds: ['acme/app'] }, linear: { enabled: false, sourceIds: null } },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/projects/${REPO_ID}/issues`, () =>
      HttpResponse.json({ issues: [], nextPage: null }),
    ),
  );
}

function renderWorkBoard() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work`] });
  return renderWithProviders(<RouterProvider router={router} />, createQueryClient());
}

describe('Board card rework reasons', () => {
  it('says a card self-review sent back is back from Review, with the first finding', async () => {
    stubWorkBoard();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Fix login bug' });
    const line = await within(card).findByText(
      'Back from Review: The retry loop never backs off, so a flaky API is hammered.',
    );
    expect(line).toHaveAttribute('title', FINDINGS);
  });

  it("shows self-review's full findings in the card's details", async () => {
    stubWorkBoard();
    const user = userEvent.setup();
    renderWorkBoard();

    await user.click(await screen.findByRole('button', { name: 'Details for Fix login bug' }));

    const details = await screen.findByRole('dialog', { name: 'Fix login bug' });
    const why = await within(details).findByRole('region', { name: 'Why it moved back' });
    expect(why).toHaveTextContent('Why it moved back from Review');
    expect(
      within(why)
        .getAllByRole('listitem')
        .map(item => item.textContent),
    ).toEqual([
      'The retry loop never backs off, so a flaky API is hammered.',
      'loadPage has no test for an empty page.',
    ]);
  });

  it("gives the agent's rationale when it sent a card from Building back to Planning", async () => {
    stubWorkBoard();
    renderWorkBoard();

    const card = await screen.findByRole('article', { name: 'Add session table' });
    expect(await within(card).findByText(`Back from Building: ${RATIONALE}`)).toBeInTheDocument();
  });
});
