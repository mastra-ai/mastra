/**
 * BDD coverage for the settings Identity section. Drives the real
 * `useIdentityIntegrationsQuery` / `useIdentityClaimsQuery` /
 * `useIdentityCandidatesQuery` stack through MSW so a save issues the
 * expected POST/DELETE calls and the section re-renders from the
 * invalidated claim list.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
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

interface Calls {
  posts: Array<{ integrationId: string; externalUserId: string; label: string; email?: string }>;
  deletes: Array<{ integrationId: string; externalUserId: string }>;
}

function stub(backend: Backend): Calls {
  const calls: Calls = { posts: [], deletes: [] };
  server.use(
    http.get(`${TEST_BASE_URL}/web/identity/integrations`, () =>
      HttpResponse.json({ integrations: backend.integrations }),
    ),
    http.get(`${TEST_BASE_URL}/web/identity/claims`, () => HttpResponse.json({ claims: backend.claims })),
    http.get(`${TEST_BASE_URL}/web/identity/candidates/:integrationId`, ({ params, request }) => {
      const url = new URL(request.url);
      const query = url.searchParams.get('query')?.toLowerCase() ?? '';
      const all = backend.candidates[String(params.integrationId)] ?? [];
      const filtered = query
        ? all.filter(
            candidate =>
              candidate.label.toLowerCase().includes(query) ||
              (candidate.email?.toLowerCase().includes(query) ?? false),
          )
        : all;
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
      backend.claims = [...backend.claims.filter(existing => existing.externalUserId !== body.externalUserId), claim];
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

const octocat: IdentityCandidate = {
  externalUserId: 'octocat',
  label: 'The Octocat',
  email: 'octocat@example.com',
  sources: ['observed'],
};
const monalisa: IdentityCandidate = {
  externalUserId: 'monalisa',
  label: 'Mona Lisa',
  sources: ['observed'],
};

describe('IdentityClaimsSection', () => {
  it('given no identity-capable integrations, when rendered, then it explains the empty state', async () => {
    stub({ integrations: [], claims: [], candidates: {} });

    renderWithProviders(<IdentityClaimsSection />);

    expect(await screen.findByText('No integrations available')).toBeInTheDocument();
  });

  it('given observed candidates on GitHub and no existing claims, when the user checks one and saves, then it POSTs a claim', async () => {
    const calls = stub({
      integrations: [{ id: 'github' }],
      claims: [],
      candidates: { github: [octocat, monalisa] },
    });

    renderWithProviders(<IdentityClaimsSection />);

    // Expander closed when there are no claims — open it explicitly.
    const expander = await screen.findByRole('button', { name: /GitHub/ });
    await userEvent.click(expander);

    const octocatLabel = await screen.findByText('The Octocat');
    // Row DOM shape: <li><input><label>{label}...</label></li> — the checkbox is the label's list-item sibling.
    const octocatCheckbox = octocatLabel.closest('li')?.querySelector('input[type="checkbox"]');
    expect(octocatCheckbox).not.toBeNull();
    await userEvent.click(octocatCheckbox as HTMLInputElement);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.posts).toHaveLength(1));
    expect(calls.posts[0]).toMatchObject({
      integrationId: 'github',
      externalUserId: 'octocat',
      label: 'The Octocat',
      email: 'octocat@example.com',
    });
    expect(calls.deletes).toHaveLength(0);
  });

  it('given an existing claim, when the user unchecks it and saves, then it DELETEs the claim', async () => {
    const calls = stub({
      integrations: [{ id: 'github' }],
      claims: [
        {
          integrationId: 'github',
          externalUserId: 'octocat',
          label: 'The Octocat',
          claimedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      candidates: { github: [octocat] },
    });

    renderWithProviders(<IdentityClaimsSection />);

    // Expander opens by default when claims exist — no click needed.
    const octocatLabel = await screen.findByText('The Octocat');
    const octocatCheckbox = octocatLabel.closest('li')?.querySelector('input[type="checkbox"]');
    expect((octocatCheckbox as HTMLInputElement).checked).toBe(true);
    await userEvent.click(octocatCheckbox as HTMLInputElement);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.deletes).toHaveLength(1));
    expect(calls.deletes[0]).toEqual({ integrationId: 'github', externalUserId: 'octocat' });
    expect(calls.posts).toHaveLength(0);
  });

  it('given a typed query, when candidates load, then only matching accounts render', async () => {
    stub({
      integrations: [{ id: 'github' }],
      claims: [],
      candidates: { github: [octocat, monalisa] },
    });

    renderWithProviders(<IdentityClaimsSection />);

    await userEvent.click(await screen.findByRole('button', { name: /GitHub/ }));
    await screen.findByText('The Octocat');

    const searchInput = screen.getByLabelText('Search GitHub accounts');
    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, 'octo');

    // Wait for the filtered query to resolve — the label whose email/id
    // does not match the substring should disappear.
    await waitFor(() => {
      expect(screen.queryByText('Mona Lisa')).not.toBeInTheDocument();
      expect(screen.queryByText('The Octocat')).toBeInTheDocument();
    });
  });

  it('given unsaved edits on integration B, when integration A is saved, then integration B keeps its unsaved edits', async () => {
    const calls = stub({
      integrations: [{ id: 'github' }, { id: 'linear' }],
      claims: [],
      candidates: {
        github: [octocat],
        linear: [{ externalUserId: 'alice', label: 'Alice Linear', sources: ['observed'] }],
      },
    });

    renderWithProviders(<IdentityClaimsSection />);

    // Open both panels.
    await userEvent.click(await screen.findByRole('button', { name: /GitHub/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Linear/ }));

    // Compose an unsaved edit on Linear: check Alice.
    const alice = await screen.findByText('Alice Linear');
    const aliceCheckbox = alice.closest('li')?.querySelector('input[type="checkbox"]');
    await userEvent.click(aliceCheckbox as HTMLInputElement);
    expect((aliceCheckbox as HTMLInputElement).checked).toBe(true);

    // Save GitHub — this invalidates the shared claims query.
    const octocatLabel = await screen.findByText('The Octocat');
    const octocatCheckbox = octocatLabel.closest('li')?.querySelector('input[type="checkbox"]');
    await userEvent.click(octocatCheckbox as HTMLInputElement);
    // Two Save buttons — GitHub's is the enabled one first (Linear's is
    // enabled too since Alice is checked). Grab both, click GitHub's.
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    // Order: GitHub first (opened first).
    await userEvent.click(saveButtons[0]);

    await waitFor(() => expect(calls.posts).toHaveLength(1));
    expect(calls.posts[0]?.integrationId).toBe('github');

    // Linear's Alice checkbox must still be checked — the shared claims
    // invalidation from the GitHub save must not clobber Linear's unsaved
    // edits.
    const aliceAfter = screen.getByText('Alice Linear');
    const aliceCheckboxAfter = aliceAfter.closest('li')?.querySelector('input[type="checkbox"]');
    expect((aliceCheckboxAfter as HTMLInputElement).checked).toBe(true);
  });

  it('given an integration with no observed candidates, when opened, then it explains and offers manual entry', async () => {
    stub({
      integrations: [{ id: 'github' }],
      claims: [],
      candidates: { github: [] },
    });

    renderWithProviders(<IdentityClaimsSection />);

    await userEvent.click(await screen.findByRole('button', { name: /GitHub/ }));

    expect(await screen.findByText(/No accounts observed yet on this integration/)).toBeInTheDocument();
    expect(screen.getByLabelText('GitHub id')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('given no candidates, when the user types an id, clicks Add, then Save, then it POSTs a claim for that manual id', async () => {
    const calls = stub({
      integrations: [{ id: 'github' }],
      claims: [],
      candidates: { github: [] },
    });

    renderWithProviders(<IdentityClaimsSection />);

    await userEvent.click(await screen.findByRole('button', { name: /GitHub/ }));

    const idInput = await screen.findByLabelText('GitHub id');
    const nameInput = screen.getByLabelText('GitHub display name');
    await userEvent.type(idInput, 'octocat');
    await userEvent.type(nameInput, 'The Octocat');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Row appears as a checked candidate — Save is now enabled but no
    // POST has landed yet.
    const octocatLabel = await screen.findByText('The Octocat');
    const octocatCheckbox = octocatLabel.closest('li')?.querySelector('input[type="checkbox"]');
    expect((octocatCheckbox as HTMLInputElement).checked).toBe(true);
    expect(calls.posts).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.posts).toHaveLength(1));
    expect(calls.posts[0]).toMatchObject({
      integrationId: 'github',
      externalUserId: 'octocat',
      label: 'The Octocat',
    });
  });

  it('given an existing checkbox edit, when the user Adds a manual id then Saves, then both the checkbox edit and the manual id are POSTed and neither is deleted', async () => {
    const monaLisa: IdentityCandidate = {
      externalUserId: 'monalisa',
      label: 'Mona Lisa',
      sources: ['observed'],
    };
    const calls = stub({
      integrations: [{ id: 'github' }],
      claims: [],
      candidates: { github: [monaLisa] },
    });

    renderWithProviders(<IdentityClaimsSection />);
    await userEvent.click(await screen.findByRole('button', { name: /GitHub/ }));

    // Check the observed candidate.
    const monalisaLabel = await screen.findByText('Mona Lisa');
    const monalisaCheckbox = monalisaLabel.closest('li')?.querySelector('input[type="checkbox"]');
    await userEvent.click(monalisaCheckbox as HTMLInputElement);

    // Add a manual id.
    await userEvent.type(screen.getByLabelText('GitHub id'), 'octocat');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    // Save.
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.posts).toHaveLength(2));

    const claimedIds = calls.posts.map(post => post.externalUserId).sort();
    expect(claimedIds).toEqual(['monalisa', 'octocat']);
    // Crucially — no DELETE was issued. The prior bug had Add's out-of-
    // band POST fire on Save's diff, causing the just-added claim to be
    // rolled back to the checkbox-edit baseline.
    expect(calls.deletes).toHaveLength(0);
  });
});
