// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ConnectionsPage from '../index';
import {
  airtableSessionResponse,
  globalOnlyConnectionsResponse,
  launchTokenUnavailable,
  mixedConnectionsResponse,
  providersResponse,
  sessionResponse,
  statusActive,
  statusPending,
  unauthorizedBody,
} from './fixtures/user-connect';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// cmdk scrolls the selected option into view; jsdom has no implementation.
if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const Wrap = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const renderPage = () =>
  render(
    <Wrap>
      <ConnectionsPage />
    </Wrap>,
  );

/** Opens the Add connection dialog and selects a provider from the picker. */
async function pickProvider(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: 'Add connection' }));
  const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
  fireEvent.click(await within(dialog).findByRole('option', { name: new RegExp(name) }));
  return dialog;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ConnectionsPage', () => {
  describe('when the connect routes are not mounted', () => {
    it('shows the setup empty state and never fetches connections', async () => {
      const onConnections = vi.fn<() => void>();
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.text('Not Found', { status: 404 })),
        http.get(`${BASE_URL}/connect/connections`, () => {
          onConnections();
          return HttpResponse.json(mixedConnectionsResponse);
        }),
      );

      renderPage();

      expect(await screen.findByText('Connect routes are not mounted')).not.toBeNull();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(onConnections).not.toHaveBeenCalled();
    });
  });

  describe('when the request carries no end-user identity', () => {
    it('shows the auth setup empty state', async () => {
      server.use(http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(unauthorizedBody, { status: 401 })));

      renderPage();

      expect(await screen.findByText('No end-user identity')).not.toBeNull();
      expect(screen.getByText(/mapUserToResourceId/)).not.toBeNull();
    });
  });

  describe('when the connections request fails', () => {
    it('shows the error in both sections instead of fake empty states', async () => {
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () =>
          HttpResponse.json({ error: { code: 'internal', message: 'Connections lookup failed' } }, { status: 500 }),
        ),
      );

      renderPage();

      const userSection = await screen.findByRole('region', { name: 'Your connections' });
      expect(await within(userSection).findByRole('alert')).not.toBeNull();
      const globalSection = screen.getByRole('region', { name: 'Global connections' });
      expect(await within(globalSection).findByRole('alert')).not.toBeNull();
      // The server never answered, so neither section may claim emptiness.
      expect(screen.queryByText("You haven't connected any accounts yet.")).toBeNull();
      expect(screen.queryByText('No global connections are linked to this project.')).toBeNull();
    });
  });

  describe('when the surface is ready with global and user connections', () => {
    it('splits the connections into tables with catalog names and row actions only on yours', async () => {
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
      );

      renderPage();

      const userSection = await screen.findByRole('region', { name: 'Your connections' });
      // The catalog resolves 'linear' to its display name.
      expect(await within(userSection).findByText('Linear')).not.toBeNull();
      expect(within(userSection).getByText('you@example.com')).not.toBeNull();
      expect(within(userSection).getByRole('button', { name: 'Actions for Linear' })).not.toBeNull();

      const globalSection = await screen.findByRole('region', { name: 'Global connections' });
      // 'notion' is outside the policy-filtered provider list, but the row
      // carries its own display metadata (resolved server-side from the full
      // catalog), so the proper name still renders.
      expect(await within(globalSection).findByText('Notion')).not.toBeNull();
      // Global rows are read-only: no row actions at all.
      expect(within(globalSection).queryByRole('button', { name: /^Actions for/ })).toBeNull();
    });

    it('disconnects one of your connections from the row menu and refetches the list', async () => {
      const onDelete = vi.fn<() => void>();
      let deleted = false;
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () =>
          HttpResponse.json(deleted ? globalOnlyConnectionsResponse : mixedConnectionsResponse),
        ),
        http.delete(`${BASE_URL}/connect/connections/conn-user-1`, () => {
          onDelete();
          deleted = true;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Actions for Linear' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Disconnect' }));

      await waitFor(() => expect(onDelete).toHaveBeenCalled());
      expect(await screen.findByText("You haven't connected any accounts yet.")).not.toBeNull();
    });
  });

  describe('when connecting a provider through the dialog', () => {
    it('filters the provider picker by search', async () => {
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
      );

      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: 'Add connection' }));
      const dialog = await screen.findByRole('dialog', { name: 'Add connection' });
      expect(await within(dialog).findByRole('option', { name: /Slack/ })).not.toBeNull();

      fireEvent.change(within(dialog).getByPlaceholderText('Search providers'), { target: { value: 'lin' } });

      expect(within(dialog).queryByRole('option', { name: /Slack/ })).toBeNull();
      expect(within(dialog).getByRole('option', { name: /Linear/ })).not.toBeNull();
    });

    it('creates a session, drives the popup, and closes the dialog once the connection is active', async () => {
      const popup = { location: { href: '' }, close: vi.fn() };
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const onSession = vi.fn<() => void>();
      let connected = false;
      let statusPolls = 0;
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        // No token released: the flow falls back to the hosted popup.
        http.get(`${BASE_URL}${sessionResponse.launchUrl}`, () => HttpResponse.json(launchTokenUnavailable)),
        http.get(`${BASE_URL}/connect/connections`, () =>
          HttpResponse.json(
            connected
              ? {
                  connections: [
                    ...mixedConnectionsResponse.connections,
                    {
                      id: sessionResponse.connectionId,
                      integrationId: 'slack',
                      status: 'active',
                      accountLabel: null,
                      scope: 'user' as const,
                    },
                  ],
                }
              : mixedConnectionsResponse,
          ),
        ),
        http.post(`${BASE_URL}/connect/slack/sessions`, () => {
          onSession();
          return HttpResponse.json(sessionResponse, { status: 201 });
        }),
        http.get(`${BASE_URL}/connect/connections/${sessionResponse.connectionId}/status`, () => {
          statusPolls += 1;
          if (statusPolls < 2) return HttpResponse.json(statusPending);
          connected = true;
          return HttpResponse.json(statusActive);
        }),
      );

      renderPage();

      const dialog = await pickProvider('Slack');

      await waitFor(() => expect(onSession).toHaveBeenCalled());
      // The popup is sent to the launch gate (resolved against the server base
      // URL), never to a raw vendor connect URL.
      await waitFor(() =>
        expect(openSpy).toHaveBeenCalledWith(
          `${BASE_URL}${sessionResponse.launchUrl}`,
          'mastra-connect',
          expect.any(String),
        ),
      );

      expect(await within(dialog).findByText('Waiting for authorization')).not.toBeNull();

      // Polling (2s interval) eventually lands on active, closes the dialog,
      // and the refreshed list shows the new connection.
      await waitFor(() => expect(statusPolls).toBeGreaterThanOrEqual(2), { timeout: 10_000 });
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add connection' })).toBeNull(), {
        timeout: 10_000,
      });
      const userSection = await screen.findByRole('region', { name: 'Your connections' });
      await waitFor(() => expect(within(userSection).getByText('Slack')).not.toBeNull(), { timeout: 10_000 });
    }, 20_000);

    it('shows a fallback link when the popup is blocked', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);

      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
        http.post(`${BASE_URL}/connect/slack/sessions`, () => HttpResponse.json(sessionResponse, { status: 201 })),
        http.get(`${BASE_URL}${sessionResponse.launchUrl}`, () => HttpResponse.json(launchTokenUnavailable)),
        http.get(`${BASE_URL}/connect/connections/${sessionResponse.connectionId}/status`, () =>
          HttpResponse.json(statusPending),
        ),
      );

      renderPage();

      const dialog = await pickProvider('Slack');

      const fallback = await within(dialog).findByRole('link', { name: 'Open the connect window' });
      expect(fallback.getAttribute('href')).toBe(`${BASE_URL}${sessionResponse.launchUrl}`);
    });

    it('closes and fully resets the flow when the user cancels a pending authorization', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);

      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
        http.post(`${BASE_URL}/connect/slack/sessions`, () => HttpResponse.json(sessionResponse, { status: 201 })),
        http.get(`${BASE_URL}${sessionResponse.launchUrl}`, () => HttpResponse.json(launchTokenUnavailable)),
        http.get(`${BASE_URL}/connect/connections/${sessionResponse.connectionId}/status`, () =>
          HttpResponse.json(statusPending),
        ),
      );

      renderPage();

      const dialog = await pickProvider('Slack');
      expect(await within(dialog).findByText('Waiting for authorization')).not.toBeNull();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add connection' })).toBeNull());

      // Reopening starts from the picker — no leftover pending state.
      fireEvent.click(await screen.findByRole('button', { name: 'Add connection' }));
      const reopened = await screen.findByRole('dialog', { name: 'Add connection' });
      expect(await within(reopened).findByRole('option', { name: /Slack/ })).not.toBeNull();
      expect(within(reopened).queryByText('Waiting for authorization')).toBeNull();
    });

    it('shows the failure with a retry when the session cannot be created', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);

      let sessionCalls = 0;
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
        http.post(`${BASE_URL}/connect/slack/sessions`, () => {
          sessionCalls += 1;
          return HttpResponse.json({ error: { code: 'internal', message: 'Session mint failed' } }, { status: 500 });
        }),
      );

      renderPage();

      const dialog = await pickProvider('Slack');

      expect(await within(dialog).findByText("Couldn't connect")).not.toBeNull();
      expect(within(dialog).getByText(/Session mint failed/)).not.toBeNull();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(sessionCalls).toBe(2));
    });
  });

  describe('when the provider needs credentials before authorizing', () => {
    it('collects the fields first and only then creates the session', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);

      const onSession = vi.fn<() => void>();
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
        http.post(`${BASE_URL}/connect/airtable/sessions`, () => {
          onSession();
          return HttpResponse.json(airtableSessionResponse, { status: 201 });
        }),
        // No token released: the credentials flow falls back to the hosted
        // popup, whose page renders the same form — the headless submission
        // itself is covered by the playground-ui hook tests.
        http.get(`${BASE_URL}${airtableSessionResponse.launchUrl}`, () => HttpResponse.json(launchTokenUnavailable)),
        http.get(`${BASE_URL}/connect/connections/${airtableSessionResponse.connectionId}/status`, () =>
          HttpResponse.json({ id: airtableSessionResponse.connectionId, status: 'pending', scope: 'user' }),
        ),
      );

      renderPage();

      const dialog = await pickProvider('Airtable');

      // The synthesized API key field renders before any session exists.
      const input = await within(dialog).findByLabelText(/API key/);
      expect(onSession).not.toHaveBeenCalled();

      fireEvent.change(input, { target: { value: 'pat-test-123' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Connect' }));

      await waitFor(() => expect(onSession).toHaveBeenCalled());
      expect(await within(dialog).findByText('Waiting for authorization')).not.toBeNull();
    });

    it('keeps the Connect action disabled until every required field is filled', async () => {
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
      );

      renderPage();

      const dialog = await pickProvider('Airtable');

      const submit = (await within(dialog).findByRole('button', { name: 'Connect' })) as HTMLButtonElement;
      expect(submit.disabled).toBe(true);

      fireEvent.change(within(dialog).getByLabelText(/API key/), { target: { value: 'pat-test-123' } });
      expect(submit.disabled).toBe(false);
    });
  });
});
