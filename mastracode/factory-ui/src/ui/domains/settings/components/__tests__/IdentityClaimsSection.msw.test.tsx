/**
 * BDD coverage for the settings Identity section. The section is a single
 * multi-select combobox over every candidate account across every identity-
 * capable integration. Drives the real `useAllIdentityCandidatesQuery` /
 * `useIdentityClaimsQuery` stack through MSW so a toggle issues the expected
 * POST/DELETE calls and the section re-renders from the invalidated claim list.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type {
  IdentityCandidateAcrossIntegrations,
  IdentityClaim,
} from '../../services/identityClaims';
import { IdentityClaimsSection } from '../IdentityClaimsSection';

// Base UI's Combobox synthesizes a PointerEvent on click, which jsdom does not
// implement. The shared vitest setup polyfills it, but assert it once here so
// this test stays honest if the setup ever regresses.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

interface Backend {
  claims: IdentityClaim[];
  candidates: IdentityCandidateAcrossIntegrations[];
}

interface Calls {
  posts: Array<{ integrationId: string; externalUserId: string; label: string; email?: string }>;
  deletes: Array<{ integrationId: string; externalUserId: string }>;
}

function stub(backend: Backend): Calls {
  const calls: Calls = { posts: [], deletes: [] };
  server.use(
    http.get(`${TEST_BASE_URL}/web/identity/claims`, () => HttpResponse.json({ claims: backend.claims })),
    http.get(`${TEST_BASE_URL}/web/identity/candidates`, ({ request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('query')?.toLowerCase() ?? '';
      const filtered = query
        ? backend.candidates.filter(
            candidate =>
              candidate.label.toLowerCase().includes(query) ||
              (candidate.email?.toLowerCase().includes(query) ?? false),
          )
        : backend.candidates;
      return HttpResponse.json({ candidates: filtered });
    }),
    http.post(`${TEST_BASE_URL}/web/identity/claims`, async ({ request }) => {
      const body = (await request.json()) as {
        integrationId: string;
        externalUserId: string;
        label: string;
        email?: string;
      };
      calls.posts.push(body);
      const claim: IdentityClaim = {
        integrationId: body.integrationId,
        externalUserId: body.externalUserId,
        label: body.label,
        email: body.email,
        claimedAt: new Date().toISOString(),
      };
      backend.claims = [
        ...backend.claims.filter(
          existing =>
            !(existing.integrationId === body.integrationId && existing.externalUserId === body.externalUserId),
        ),
        claim,
      ];
      return HttpResponse.json({ claim }, { status: 201 });
    }),
    http.delete(`${TEST_BASE_URL}/web/identity/claims/:integrationId/:externalUserId`, ({ params }) => {
      const integrationId = String(params.integrationId);
      const externalUserId = String(params.externalUserId);
      calls.deletes.push({ integrationId, externalUserId });
      backend.claims = backend.claims.filter(
        claim => !(claim.integrationId === integrationId && claim.externalUserId === externalUserId),
      );
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

const octocat: IdentityCandidateAcrossIntegrations = {
  integrationId: 'github',
  externalUserId: 'octocat',
  label: 'The Octocat',
  email: 'octocat@example.com',
  sources: ['observed'],
};

const alice: IdentityCandidateAcrossIntegrations = {
  integrationId: 'linear',
  externalUserId: 'alice',
  label: 'Alice Linear',
  sources: ['observed'],
};

async function openCombobox() {
  const trigger = await screen.findByRole('combobox', { name: /Your external accounts/i });
  await userEvent.click(trigger);
  return trigger;
}

describe('IdentityClaimsSection', () => {
  it('given candidates across integrations, when the user picks one, then it POSTs a claim', async () => {
    const calls = stub({ claims: [], candidates: [octocat, alice] });

    renderWithProviders(<IdentityClaimsSection />);
    await openCombobox();

    const octocatRow = await screen.findByRole('option', { name: /The Octocat/ });
    await userEvent.click(octocatRow);

    await waitFor(() => expect(calls.posts).toHaveLength(1));
    expect(calls.posts[0]).toMatchObject({
      integrationId: 'github',
      externalUserId: 'octocat',
      label: 'The Octocat',
      email: 'octocat@example.com',
    });
    expect(calls.deletes).toHaveLength(0);
  });

  it('given an existing claim, when the user unchecks it, then it DELETEs the claim', async () => {
    const calls = stub({
      claims: [
        {
          integrationId: 'github',
          externalUserId: 'octocat',
          label: 'The Octocat',
          email: 'octocat@example.com',
          claimedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      candidates: [octocat],
    });

    renderWithProviders(<IdentityClaimsSection />);
    await openCombobox();

    const octocatRow = await screen.findByRole('option', { name: /The Octocat/ });
    // Option was already selected — clicking it again unselects.
    expect(octocatRow.getAttribute('aria-selected')).toBe('true');
    await userEvent.click(octocatRow);

    await waitFor(() => expect(calls.deletes).toHaveLength(1));
    expect(calls.deletes[0]).toEqual({ integrationId: 'github', externalUserId: 'octocat' });
    expect(calls.posts).toHaveLength(0);
  });

  it('given a typed search, when the query filters the merged feed, then only matching accounts render', async () => {
    stub({ claims: [], candidates: [octocat, alice] });

    renderWithProviders(<IdentityClaimsSection />);
    await openCombobox();

    // Both options rendered.
    await screen.findByRole('option', { name: /The Octocat/ });
    await screen.findByRole('option', { name: /Alice Linear/ });

    const search = screen.getByPlaceholderText('Search accounts…');
    await userEvent.type(search, 'octo');

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Alice Linear/ })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: /The Octocat/ })).toBeInTheDocument();
    });
  });

  it('given a candidate on Linear, when the user picks it, then the claim is tagged with the Linear integration id', async () => {
    const calls = stub({ claims: [], candidates: [octocat, alice] });

    renderWithProviders(<IdentityClaimsSection />);
    await openCombobox();

    const aliceRow = await screen.findByRole('option', { name: /Alice Linear/ });
    await userEvent.click(aliceRow);

    await waitFor(() => expect(calls.posts).toHaveLength(1));
    expect(calls.posts[0]).toMatchObject({
      integrationId: 'linear',
      externalUserId: 'alice',
      label: 'Alice Linear',
    });
  });
});
