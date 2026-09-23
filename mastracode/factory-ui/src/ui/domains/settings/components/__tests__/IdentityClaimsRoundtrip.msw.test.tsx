/**
 * E2E stand-in for the Phase 5 Playwright scenario: claiming an account
 * in the settings section should flow through the shared identity query and
 * update `useResolvedMe`. Any board or Cmd+K surface reading
 * `useResolvedMe` sees the newly claimed id without a page reload.
 *
 * The plan calls for a Playwright test, but factory-ui uses MSW as its
 * primary e2e substrate (per its AGENTS.md — Playwright is only used for
 * cross-page journeys MSW cannot model). This test runs the settings
 * section and a `useResolvedMe`-consuming stand-in through the same
 * React Query cache, proving the invalidation reaches every consumer.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { useResolvedMe } from '../../../../../hooks/useIdentityClaims';
import { boardRelevanceOptions, workItemMatchesMe } from '../../../factory/boardRelevance';
import type { WorkItem } from '../../../factory/services/workItems';
import type { IdentityIndex, IdentityRow } from '../../services/identityClaims';
import { IdentityClaimsSection } from '../IdentityClaimsSection';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

interface Backend {
  index: IdentityIndex;
}

function setClaimed(
  index: IdentityIndex,
  integrationId: string,
  externalUserId: string,
  claimed: boolean,
): IdentityIndex {
  return {
    ...index,
    identities: index.identities.map(row =>
      row.integrationId === integrationId && row.externalUserId === externalUserId ? { ...row, claimed } : row,
    ),
  };
}

function stub(backend: Backend) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/identity`, () => HttpResponse.json(backend.index)),
    http.post(`${TEST_BASE_URL}/web/identity`, async ({ request }) => {
      const body = (await request.json()) as {
        integrationId: string;
        externalUserId: string;
        label: string;
        email?: string;
      };
      backend.index = setClaimed(backend.index, body.integrationId, body.externalUserId, true);
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(`${TEST_BASE_URL}/web/identity`, ({ request }) => {
      const url = new URL(request.url);
      const integrationId = String(url.searchParams.get('integrationId') ?? '');
      const externalUserId = String(url.searchParams.get('externalUserId') ?? '');
      backend.index = setClaimed(backend.index, integrationId, externalUserId, false);
      return new HttpResponse(null, { status: 204 });
    }),
  );
}

function ResolvedMeReadout() {
  const resolvedMe = useResolvedMe();
  if (resolvedMe.isLoading) return <output aria-label="resolved-me">loading</output>;
  const entries: string[] = [];
  for (const [integrationId, externalIds] of resolvedMe.data) {
    for (const externalId of externalIds) entries.push(`${integrationId}:${externalId}`);
  }
  return <output aria-label="resolved-me">{entries.length === 0 ? 'empty' : entries.sort().join(',')}</output>;
}

/**
 * Board `@me` chip stand-in: feeds the acting user's resolved-me set
 * straight through the real `workItemMatchesMe` predicate against a
 * fixture GitHub PR authored by `octocat`. Renders `match` or `no
 * match` — matches only when a claim on `github:octocat` exists.
 */
function BoardMeMatchReadout({ item }: { item: WorkItem }) {
  const resolvedMe = useResolvedMe();
  const allTypes = new Set(boardRelevanceOptions('review').map(option => option.id));
  const matches = workItemMatchesMe(item, undefined, resolvedMe.data, allTypes);
  return <output aria-label="board-me-match">{matches ? 'match' : 'no match'}</output>;
}

const githubPr: WorkItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'factory-rule-dispatcher',
  githubProjectId: 'factory-1',
  source: 'github-pr',
  sourceKey: 'github-pr:12',
  parentWorkItemId: null,
  title: 'Ship @me filter',
  url: 'https://github.com/acme/app/pull/12',
  stages: ['review'],
  stageHistory: [],
  sessions: {},
  metadata: { author: 'octocat', assignees: [], requestedReviewers: [] },
  triageType: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
};

const octocatRow: IdentityRow = {
  integrationId: 'github',
  externalUserId: 'octocat',
  label: 'The Octocat',
  claimed: false,
};

function baseIndex(rows: IdentityRow[]): IdentityIndex {
  const integrationIds = Array.from(new Set(rows.map(r => r.integrationId))).sort();
  return {
    integrations: integrationIds.map(id => ({ id })),
    identities: rows,
  };
}

async function selectOctocat() {
  const trigger = await screen.findByRole('combobox', { name: /Your external accounts/i });
  await userEvent.click(trigger);
  const option = await screen.findByRole('option', { name: /The Octocat/ });
  await userEvent.click(option);
}

describe('IdentityClaimsSection ↔ useResolvedMe roundtrip', () => {
  it('given a fresh claim on the settings section, when picked, then useResolvedMe re-renders with the new id', async () => {
    stub({ index: baseIndex([octocatRow]) });

    renderWithProviders(
      <div>
        <ResolvedMeReadout />
        <IdentityClaimsSection />
      </div>,
    );

    const readout = await screen.findByLabelText('resolved-me');
    await waitFor(() => expect(readout).toHaveTextContent('empty'));

    await selectOctocat();

    await waitFor(() => expect(readout).toHaveTextContent('github:octocat'));
  });

  it('given a board `@me` predicate composed with useResolvedMe, when a claim is picked on settings, then the predicate flips from no-match to match', async () => {
    stub({ index: baseIndex([octocatRow]) });

    renderWithProviders(
      <div>
        <BoardMeMatchReadout item={githubPr} />
        <IdentityClaimsSection />
      </div>,
    );

    const match = await screen.findByLabelText('board-me-match');
    await waitFor(() => expect(match).toHaveTextContent('no match'));

    await selectOctocat();

    await waitFor(() => expect(match).toHaveTextContent('match'));
  });
});
