import userEvent from '@testing-library/user-event';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../../e2e/ui/render';
import type { CredentialRequestResponse } from '../../../hooks/use-credential-request';
import { CredentialRequestPage } from '../CredentialRequestPage';

const REQUEST_ID = '11111111-2222-4333-8444-555555555555';
const SECRET = 'sk_test_fake_throwaway_0123456789';
const url = `${TEST_BASE_URL}/web/credential-requests/${REQUEST_ID}`;

function pending(status: CredentialRequestResponse['request']['status'] = 'pending'): CredentialRequestResponse {
  return {
    request: {
      id: REQUEST_ID,
      name: 'STRIPE_TEST_KEY',
      purpose: 'Run the Stripe integration tests',
      sessionId: 'sess-a',
      factoryProjectId: 'fp-1',
      status,
      expiresAt: '2026-11-06T22:00:00.000Z',
    },
    session: { id: 'sess-a', title: 'Payments work' },
    defaultTtlMs: 4 * 60 * 60 * 1000,
    maxTtlMs: 24 * 60 * 60 * 1000,
  };
}

function renderPage() {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/credentials/${REQUEST_ID}`]}>
      <Routes>
        <Route path="/credentials/:requestId" element={<CredentialRequestPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CredentialRequestPage', () => {
  it('given a pending request, when the owner submits, then the value is sent only in the JSON body and the page confirms', async () => {
    let state = pending();
    const bodies: unknown[] = [];
    server.use(
      http.get(url, () => HttpResponse.json(state)),
      http.post(url, async ({ request }) => {
        expect(request.headers.get('content-type')).toBe('application/json');
        bodies.push(await request.json());
        state = pending('fulfilled');
        return HttpResponse.json({ credential: { name: 'STRIPE_TEST_KEY', expiresAt: state.request.expiresAt } });
      }),
    );

    const { container, client } = renderPage();
    expect(await screen.findByText(/least-privilege test credential/)).toBeInTheDocument();
    expect(screen.getByText('STRIPE_TEST_KEY')).toBeInTheDocument();

    const sandboxToggle = screen.getByRole('checkbox', { name: /pass it to commands in its sandbox/ });
    expect(sandboxToggle).not.toBeChecked();

    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    await userEvent.type(input, SECRET);
    await userEvent.click(sandboxToggle);
    await userEvent.click(screen.getByRole('button', { name: 'Save credential' }));
    await waitForMutationsIdle(client);

    expect(bodies).toEqual([{ value: SECRET, ttlMs: 4 * 60 * 60 * 1000, allowSandbox: true }]);
    expect(await screen.findByText(/STRIPE_TEST_KEY was saved/)).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(SECRET);
  });

  it('given a pending request, when the owner submits without opting in, then sandbox use stays off', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.get(url, () => HttpResponse.json(pending())),
      http.post(url, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ credential: { name: 'STRIPE_TEST_KEY', expiresAt: '2026-11-06T22:00:00.000Z' } });
      }),
    );

    const { container, client } = renderPage();
    await screen.findByRole('button', { name: 'Save credential' });
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    await userEvent.type(input, SECRET);
    await userEvent.click(screen.getByRole('button', { name: 'Save credential' }));
    await waitForMutationsIdle(client);

    expect(bodies).toEqual([{ value: SECRET, ttlMs: 4 * 60 * 60 * 1000, allowSandbox: false }]);
  });

  it('given a rejected submission, when the owner edits the value, then the error clears', async () => {
    server.use(
      http.get(url, () => HttpResponse.json(pending())),
      http.post(url, () => HttpResponse.json({ error: 'The credential is too large.' }, { status: 413 })),
    );

    const { container, client } = renderPage();
    await screen.findByRole('button', { name: 'Save credential' });
    const input = container.querySelector<HTMLInputElement>('input[type="password"]')!;
    await userEvent.type(input, SECRET);
    await userEvent.click(screen.getByRole('button', { name: 'Save credential' }));
    await waitForMutationsIdle(client);
    expect(await screen.findByText(/too large/)).toBeInTheDocument();

    await userEvent.type(input, 'x');
    expect(screen.queryByText(/too large/)).not.toBeInTheDocument();
  });

  it('given a request already used, when rendered, then it does not claim the value was saved', async () => {
    server.use(http.get(url, () => HttpResponse.json(pending('fulfilled'))));
    renderPage();
    expect(await screen.findByText(/This link was already used/)).toBeInTheDocument();
    expect(screen.queryByText(/was saved/)).not.toBeInTheDocument();
  });

  it('given an expired request, when rendered, then no form is shown', async () => {
    server.use(http.get(url, () => HttpResponse.json(pending('expired'))));
    renderPage();
    expect(await screen.findByText(/This link has expired/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save credential' })).not.toBeInTheDocument();
  });

  it('given someone else’s request, when rendered, then it shows not found', async () => {
    server.use(http.get(url, () => HttpResponse.json({ error: 'Request not found' }, { status: 404 })));
    renderPage();
    expect(await screen.findByText(/does not exist or is not yours/)).toBeInTheDocument();
  });
});
