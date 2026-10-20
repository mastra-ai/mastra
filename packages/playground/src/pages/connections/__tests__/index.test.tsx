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
  globalOnlyConnectionsResponse,
  mixedConnectionsResponse,
  providersResponse,
  sessionResponse,
  statusActive,
  statusPending,
  unauthorizedBody,
} from './fixtures/user-connect';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

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
    it('splits the connections into separate tables with disconnect only on yours', async () => {
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
      );

      renderPage();

      const userSection = await screen.findByRole('region', { name: 'Your connections' });
      expect(await within(userSection).findByText('linear')).not.toBeNull();
      expect(within(userSection).getByText('you@example.com')).not.toBeNull();
      expect(within(userSection).getByRole('button', { name: 'Disconnect' })).not.toBeNull();

      const globalSection = await screen.findByRole('region', { name: 'Global connections' });
      expect(await within(globalSection).findByText('notion')).not.toBeNull();
      expect(within(globalSection).queryByRole('button', { name: 'Disconnect' })).toBeNull();
    });

    it('disconnects one of your connections and refetches the list', async () => {
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

      fireEvent.click(await screen.findByRole('button', { name: 'Disconnect' }));

      await waitFor(() => expect(onDelete).toHaveBeenCalled());
      expect(await screen.findByText("You haven't connected any accounts yet.")).not.toBeNull();
    });
  });

  describe('when connecting a provider', () => {
    it('creates a session, drives the popup, and polls until the connection is active', async () => {
      const popup = { location: { href: '' }, close: vi.fn() };
      const openSpy = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);

      const onSession = vi.fn<() => void>();
      let connected = false;
      let statusPolls = 0;
      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
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

      const addSection = await screen.findByRole('region', { name: 'Add a connection' });
      const slackRow = within(addSection).getByText('Slack').closest('li') as HTMLLIElement;
      fireEvent.click(within(slackRow).getByRole('button', { name: 'Connect' }));

      await waitFor(() => expect(onSession).toHaveBeenCalled());
      expect(openSpy).toHaveBeenCalled();
      // The popup is sent to the launch gate (resolved against the server base
      // URL), never to a raw vendor connect URL.
      await waitFor(() => expect(popup.location.href).toBe(`${BASE_URL}${sessionResponse.launchUrl}`));

      expect(await within(slackRow).findByRole('status')).not.toBeNull();

      // Polling (2s interval) eventually lands on active and refreshes the list.
      await waitFor(() => expect(statusPolls).toBeGreaterThanOrEqual(2), { timeout: 10_000 });
      const userSection = await screen.findByRole('region', { name: 'Your connections' });
      await waitFor(() => expect(within(userSection).getByText('slack')).not.toBeNull(), { timeout: 10_000 });
    }, 20_000);

    it('shows a fallback link when the popup is blocked', async () => {
      vi.spyOn(window, 'open').mockReturnValue(null);

      server.use(
        http.get(`${BASE_URL}/connect/providers`, () => HttpResponse.json(providersResponse)),
        http.get(`${BASE_URL}/connect/connections`, () => HttpResponse.json(mixedConnectionsResponse)),
        http.post(`${BASE_URL}/connect/slack/sessions`, () => HttpResponse.json(sessionResponse, { status: 201 })),
        http.get(`${BASE_URL}/connect/connections/${sessionResponse.connectionId}/status`, () =>
          HttpResponse.json(statusPending),
        ),
      );

      renderPage();

      const addSection = await screen.findByRole('region', { name: 'Add a connection' });
      const slackRow = within(addSection).getByText('Slack').closest('li') as HTMLLIElement;
      fireEvent.click(within(slackRow).getByRole('button', { name: 'Connect' }));

      const fallback = await within(slackRow).findByRole('link', { name: 'Open the connect window' });
      expect(fallback.getAttribute('href')).toBe(`${BASE_URL}${sessionResponse.launchUrl}`);
    });
  });
});
