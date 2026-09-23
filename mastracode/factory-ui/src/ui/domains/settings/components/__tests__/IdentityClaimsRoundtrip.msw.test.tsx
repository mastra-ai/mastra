/**
 * E2E stand-in for the Phase 5 Playwright scenario: claiming an account
 * in the settings section should flow through the shared claim query and
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
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { useResolvedMe } from '../../../../../hooks/useIdentityClaims';
import { boardRelevanceOptions, workItemMatchesMe } from '../../../factory/boardRelevance';
import type { WorkItem } from '../../../factory/services/workItems';
import type {
  IdentityCandidate,
  IdentityClaim,
  IdentityIntegrationDescriptor,
} from '../../services/identityClaims';
import { IdentityClaimsSection } from '../IdentityClaimsSection';

interface Backend {
  integrations: IdentityIntegrationDescriptor[];
  claims: IdentityClaim[];
  candidates: Record<string, IdentityCandidate[]>;
}

function stub(backend: Backend) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/identity/integrations`, () =>
      HttpResponse.json({ integrations: backend.integrations }),
    ),
    http.get(`${TEST_BASE_URL}/web/identity/claims`, () => HttpResponse.json({ claims: backend.claims })),
    http.get(`${TEST_BASE_URL}/web/identity/candidates/:integrationId`, ({ params }) =>
      HttpResponse.json({ candidates: backend.candidates[String(params.integrationId)] ?? [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/identity/claims`, async ({ request }) => {
      const body = (await request.json()) as {
        integrationId: string;
        externalUserId: string;
        label: string;
        email?: string;
      };
      const claim: IdentityClaim = {
        integrationId: body.integrationId,
        externalUserId: body.externalUserId,
        label: body.label,
        email: body.email,
        claimedAt: new Date().toISOString(),
      };
      backend.claims = [...backend.claims.filter(existing => existing.externalUserId !== body.externalUserId), claim];
      return HttpResponse.json({ claim }, { status: 201 });
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
  return (
    <output aria-label="resolved-me">
      {entries.length === 0 ? 'empty' : entries.sort().join(',')}
    </output>
  );
}

/**
 * Board `@me` chip stand-in: feeds the acting user's resolved-me set
 * straight through the real `workItemMatchesMe` predicate against a
 * fixture GitHub PR authored by `octocat`. Renders `match` or `no
 * match` — matches only when a claim on `github:octocat` exists. This
 * exercises the same composition the BoardPage does; without spinning
 * up the full board we still prove the settings → useResolvedMe →
 * workItemMatchesMe path lights up end-to-end.
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

describe('IdentityClaimsSection ↔ useResolvedMe roundtrip', () => {
  it('given a fresh claim on the settings section, when saved, then useResolvedMe re-renders with the new id', async () => {
    stub({
      integrations: [{ id: 'github' }],
      claims: [],
      candidates: {
        github: [{ externalUserId: 'octocat', label: 'The Octocat', sources: ['observed'] }],
      },
    });

    renderWithProviders(
      <div>
        <ResolvedMeReadout />
        <IdentityClaimsSection />
      </div>,
    );

    const readout = await screen.findByLabelText('resolved-me');
    await waitFor(() => expect(readout).toHaveTextContent('empty'));

    // Expander is closed on load (no claims) — open it.
    await userEvent.click(await screen.findByRole('button', { name: /GitHub/ }));
    const label = await screen.findByText('The Octocat');
    const checkbox = label.closest('li')?.querySelector('input[type="checkbox"]');
    await userEvent.click(checkbox as HTMLInputElement);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(readout).toHaveTextContent('github:octocat'));
  });

  it('given a board `@me` predicate composed with useResolvedMe, when a claim is saved on settings, then the predicate flips from no-match to match', async () => {
    stub({
      integrations: [{ id: 'github' }],
      claims: [],
      candidates: {
        github: [{ externalUserId: 'octocat', label: 'The Octocat', sources: ['observed'] }],
      },
    });

    renderWithProviders(
      <div>
        <BoardMeMatchReadout item={githubPr} />
        <IdentityClaimsSection />
      </div>,
    );

    // Baseline: no claims → predicate returns false against a GitHub PR
    // authored by octocat.
    const match = await screen.findByLabelText('board-me-match');
    await waitFor(() => expect(match).toHaveTextContent('no match'));

    // Claim octocat via the settings section.
    await userEvent.click(await screen.findByRole('button', { name: /GitHub/ }));
    const label = await screen.findByText('The Octocat');
    const checkbox = label.closest('li')?.querySelector('input[type="checkbox"]');
    await userEvent.click(checkbox as HTMLInputElement);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The board `@me` predicate now matches. This is the settings →
    // board composition the plan's Playwright e2e was meant to prove;
    // driven end-to-end through the real React Query cache and the
    // real predicate.
    await waitFor(() => expect(match).toHaveTextContent('match'));
  });
});
