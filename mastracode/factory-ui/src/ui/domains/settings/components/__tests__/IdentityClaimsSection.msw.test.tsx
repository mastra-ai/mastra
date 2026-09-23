/**
 * BDD coverage for the settings Identity section. The section is a single
 * multi-select combobox over every identity across every identity-capable
 * integration. Drives the real `useIdentityQuery` stack through MSW so a
 * toggle issues the expected POST/DELETE calls on the consolidated
 * `/web/identity` endpoint and the section re-renders from the invalidated
 * identity index.
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { IdentityIndex, IdentityRow } from '../../services/identityClaims';
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
  index: IdentityIndex;
}

interface Calls {
  posts: Array<{ integrationId: string; externalUserId: string; label: string; email?: string }>;
  deletes: Array<{ integrationId: string; externalUserId: string }>;
}

function setClaimed(index: IdentityIndex, integrationId: string, externalUserId: string, claimed: boolean): IdentityIndex {
  return {
    ...index,
    identities: index.identities.map(row =>
      row.integrationId === integrationId && row.externalUserId === externalUserId ? { ...row, claimed } : row,
    ),
  };
}

function stub(backend: Backend): Calls {
  const calls: Calls = { posts: [], deletes: [] };
  server.use(
    http.get(`${TEST_BASE_URL}/web/identity`, () => HttpResponse.json(backend.index)),
    http.post(`${TEST_BASE_URL}/web/identity`, async ({ request }) => {
      const body = (await request.json()) as {
        integrationId: string;
        externalUserId: string;
        label: string;
        email?: string;
      };
      calls.posts.push(body);
      backend.index = setClaimed(backend.index, body.integrationId, body.externalUserId, true);
      return new HttpResponse(null, { status: 201 });
    }),
    http.delete(`${TEST_BASE_URL}/web/identity`, ({ request }) => {
      const url = new URL(request.url);
      const integrationId = String(url.searchParams.get('integrationId') ?? '');
      const externalUserId = String(url.searchParams.get('externalUserId') ?? '');
      calls.deletes.push({ integrationId, externalUserId });
      backend.index = setClaimed(backend.index, integrationId, externalUserId, false);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

const octocat: IdentityRow = {
  integrationId: 'github',
  externalUserId: 'octocat',
  label: 'The Octocat',
  email: 'octocat@example.com',
  claimed: false,
};

const alice: IdentityRow = {
  integrationId: 'linear',
  externalUserId: 'alice',
  label: 'Alice Linear',
  claimed: false,
};

function baseIndex(rows: IdentityRow[]): IdentityIndex {
  const integrationIds = Array.from(new Set(rows.map(r => r.integrationId))).sort();
  return {
    integrations: integrationIds.map(id => ({ id })),
    identities: rows,
  };
}

async function openCombobox() {
  const trigger = await screen.findByRole('combobox', { name: /Your external accounts/i });
  await userEvent.click(trigger);
  return trigger;
}

describe('IdentityClaimsSection', () => {
  it('given identities across integrations, when the user picks one, then it POSTs a claim', async () => {
    const calls = stub({ index: baseIndex([octocat, alice]) });

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
      index: baseIndex([{ ...octocat, claimed: true }]),
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
    stub({ index: baseIndex([octocat, alice]) });

    renderWithProviders(<IdentityClaimsSection />);
    await openCombobox();

    // Both options rendered.
    await screen.findByRole('option', { name: /The Octocat/ });
    await screen.findByRole('option', { name: /Alice Linear/ });

    const search = screen.getByPlaceholderText('Search by name, id, or email…');
    await userEvent.type(search, 'octo');

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: /Alice Linear/ })).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: /The Octocat/ })).toBeInTheDocument();
    });
  });

  it('given a candidate on Linear, when the user picks it, then the claim is tagged with the Linear integration id', async () => {
    const calls = stub({ index: baseIndex([octocat, alice]) });

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
