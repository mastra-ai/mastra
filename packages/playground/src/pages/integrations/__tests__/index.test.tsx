import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IntegrationsPage from '../index';
import { adminConnections, composioProviders, composioToolkits } from './fixtures/tool-providers';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const PROVIDER = 'composio';
const TOOLKIT = 'gmail';

const Wrap = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('IntegrationsPage', () => {
  afterEach(() => cleanup());

  it('groups connections by authorId for admins with shared connections last', async () => {
    const onDisconnect = vi.fn();
    const onProviders = vi.fn();
    const onToolkits = vi.fn();

    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'me', permissions: ['tool-providers:admin'] })),
      http.get(`${BASE_URL}/api/tool-providers`, () => {
        onProviders();
        return HttpResponse.json(composioProviders);
      }),
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/toolkits`, () => {
        onToolkits();
        return HttpResponse.json(composioToolkits);
      }),
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () => HttpResponse.json(adminConnections)),
      http.delete(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections/conn_a`, ({ request }) => {
        onDisconnect(new URL(request.url).searchParams.get('force'));
        return HttpResponse.json({ success: true });
      }),
    );

    const { findByTestId, findByRole, container } = render(
      <Wrap>
        <IntegrationsPage />
      </Wrap>,
    );

    const providerSelect = await findByRole('combobox', { name: 'Provider' });
    await waitFor(() => expect(onProviders).toHaveBeenCalled());
    fireEvent.click(providerSelect);
    const providerOption = await findByRole('option', { name: 'Composio (composio)' });
    fireEvent.pointerDown(providerOption, { pointerType: 'mouse' });
    fireEvent.click(providerOption, { detail: 1 });

    const toolkitSelect = await findByRole('combobox', { name: 'Toolkit' });
    await waitFor(() => expect(onToolkits).toHaveBeenCalled());
    fireEvent.click(toolkitSelect);
    const toolkitOption = await findByRole('option', { name: 'Gmail (gmail)' });
    fireEvent.pointerDown(toolkitOption, { pointerType: 'mouse' });
    fireEvent.click(toolkitOption, { detail: 1 });

    const groupA = await findByTestId('integration-author-group-user_A');
    expect(groupA.textContent).toContain('Owned by user_A');
    const groupB = await findByTestId('integration-author-group-user_B');
    expect(groupB.textContent).toContain('Owned by user_B');
    const sharedGroup = await findByTestId('integration-author-group-shared');
    expect(sharedGroup.textContent).toContain('Shared');
    expect(sharedGroup.parentElement?.textContent).toContain('Unknown author');

    const headings = Array.from(container.querySelectorAll('[data-testid^="integration-author-group-"]')).map(element =>
      element.getAttribute('data-testid'),
    );
    expect(headings).toEqual([
      'integration-author-group-user_A',
      'integration-author-group-user_B',
      'integration-author-group-shared',
    ]);

    fireEvent.click(groupA.parentElement?.querySelector('button') as HTMLButtonElement);
    await waitFor(() => expect(onDisconnect).toHaveBeenCalledWith(null));
  });
});
