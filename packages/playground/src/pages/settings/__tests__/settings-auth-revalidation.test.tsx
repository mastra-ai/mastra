// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StudioSettingsPage } from '../index';
import { StudioConfigContext } from '@/domains/configuration/context/studio-config-state';
import type { StudioConfigContextType } from '@/domains/configuration/context/studio-config-state';

/**
 * Tests for issue https://github.com/mastra-ai/mastra/issues/20223
 *
 * When auth is enabled but the provider exposes no login method, settings is
 * the only reachable page. Saving the Authorization header there must
 * re-evaluate the auth gate, otherwise the user stays locked out until they
 * reload the page by hand.
 */
const renderSettingsPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['auth', 'capabilities'], { enabled: true, login: null });
  queryClient.setQueryData(['permission-patterns'], []);

  const contextValue: StudioConfigContextType = {
    baseUrl: 'http://localhost:4111',
    headers: {},
    apiPrefix: '/api',
    isLoading: false,
    setConfig: vi.fn(),
  };

  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <StudioConfigContext.Provider value={contextValue}>
        <StudioSettingsPage />
      </StudioConfigContext.Provider>
    </QueryClientProvider>,
  );

  return { container, queryClient };
};

afterEach(() => {
  cleanup();
});

describe('StudioSettingsPage', () => {
  it('does not invalidate the cached auth state before the config is saved', () => {
    const { queryClient } = renderSettingsPage();

    expect(queryClient.getQueryState(['auth', 'capabilities'])?.isInvalidated).toBe(false);
  });

  it('re-evaluates auth capabilities and permission patterns after the config is saved', async () => {
    const { container, queryClient } = renderSettingsPage();

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(queryClient.getQueryState(['auth', 'capabilities'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['permission-patterns'])?.isInvalidated).toBe(true);
    });

    expect(screen.getByRole('button', { name: /save configuration/i })).toBeDefined();
  });
});
