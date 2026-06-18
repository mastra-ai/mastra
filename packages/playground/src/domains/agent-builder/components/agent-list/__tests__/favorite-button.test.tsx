// @vitest-environment jsdom
import type { BuilderSettingsResponse, FavoriteToggleResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FavoriteButton } from '../favorite-button';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const authenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
  user: { id: 'user-1', email: 'u@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: false, acl: false },
  access: null,
} satisfies AuthCapabilities;

const unauthenticatedCapabilities = {
  enabled: true,
  login: { type: 'credentials' as const },
} satisfies AuthCapabilities;

const settingsFavoritesOn: BuilderSettingsResponse = {
  enabled: true,
  features: {
    agent: { favorites: true },
  },
};

function useFavoritesHandlers(capabilities: AuthCapabilities) {
  return [
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(settingsFavoritesOn)),
  ];
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

async function waitForFavoritesGate() {
  // The features.favorites flag gates rendering; wait for it to resolve.
  await waitFor(() => {
    expect(screen.queryByRole('button')).not.toBeNull();
  });
}

afterEach(() => cleanup());

describe('FavoriteButton', () => {
  it('renders singular Star text with the count when count is 1', async () => {
    server.use(...useFavoritesHandlers(authenticatedCapabilities));

    render(
      <Wrapper>
        <FavoriteButton agentId="agent-1" favoriteCount={1} />
      </Wrapper>,
    );

    await waitForFavoritesGate();
    expect(screen.getByRole('button', { name: 'Star agent' })).toBeTruthy();
    expect(screen.getByText('Star')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders plural Stars text with the count when count is not 1', async () => {
    server.use(...useFavoritesHandlers(authenticatedCapabilities));

    render(
      <Wrapper>
        <FavoriteButton agentId="agent-1" favoriteCount={2} />
      </Wrapper>,
    );

    await waitForFavoritesGate();
    expect(screen.getByText('Stars')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders as disabled with a sign-in label when the user is not authenticated', async () => {
    server.use(...useFavoritesHandlers(unauthenticatedCapabilities));

    render(
      <Wrapper>
        <FavoriteButton agentId="agent-1" favoriteCount={1} />
      </Wrapper>,
    );

    await waitForFavoritesGate();
    const button = screen.getByRole('button', { name: 'Sign in to star this agent' });
    expect(button).toBeTruthy();
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not issue a favorite request when an unauthenticated user clicks the button', async () => {
    const favoriteCalls: string[] = [];
    server.use(
      ...useFavoritesHandlers(unauthenticatedCapabilities),
      http.put(`${BASE_URL}/api/stored/agents/:id/favorite`, ({ request }) => {
        favoriteCalls.push(request.url);
        return HttpResponse.json({ favorited: true, favoriteCount: 2 } satisfies FavoriteToggleResponse);
      }),
    );

    render(
      <Wrapper>
        <FavoriteButton agentId="agent-1" favoriteCount={1} />
      </Wrapper>,
    );

    await waitForFavoritesGate();
    fireEvent.click(screen.getByRole('button'));

    // Give any in-flight microtasks a tick to settle.
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
    expect(favoriteCalls).toHaveLength(0);
  });

  it('issues a PUT to the favorite endpoint when an authenticated user stars an agent', async () => {
    const favoriteRequests: string[] = [];
    server.use(
      ...useFavoritesHandlers(authenticatedCapabilities),
      http.put(`${BASE_URL}/api/stored/agents/:id/favorite`, ({ request, params }) => {
        favoriteRequests.push(String(params.id));
        return HttpResponse.json({ favorited: true, favoriteCount: 2 } satisfies FavoriteToggleResponse, {
          headers: { 'x-method': request.method },
        });
      }),
    );

    render(
      <Wrapper>
        <FavoriteButton agentId="agent-1" favoriteCount={1} />
      </Wrapper>,
    );

    await waitForFavoritesGate();
    fireEvent.click(screen.getByRole('button', { name: 'Star agent' }));

    await waitFor(() => expect(favoriteRequests).toEqual(['agent-1']));
  });

  it('issues a DELETE to the favorite endpoint when an authenticated user unstars an agent', async () => {
    const unfavoriteRequests: string[] = [];
    server.use(
      ...useFavoritesHandlers(authenticatedCapabilities),
      http.delete(`${BASE_URL}/api/stored/agents/:id/favorite`, ({ params }) => {
        unfavoriteRequests.push(String(params.id));
        return HttpResponse.json({ favorited: false, favoriteCount: 0 } satisfies FavoriteToggleResponse);
      }),
    );

    render(
      <Wrapper>
        <FavoriteButton agentId="agent-1" isFavorited favoriteCount={1} />
      </Wrapper>,
    );

    await waitForFavoritesGate();
    fireEvent.click(screen.getByRole('button', { name: 'Unstar agent' }));

    await waitFor(() => expect(unfavoriteRequests).toEqual(['agent-1']));
  });
});
