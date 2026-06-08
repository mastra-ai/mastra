// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import IntegrationsPage from '../index';

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
  const server = setupServer();
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    cleanup();
    server.resetHandlers();
  });
  afterAll(() => server.close());

  it('groups connections by authorId for admins when more than one author is present', async () => {
    server.use(
      http.get(`${BASE_URL}/api/auth/me`, () => HttpResponse.json({ id: 'me', permissions: ['tool-providers:admin'] })),
      http.get(`${BASE_URL}/api/tool-providers`, () =>
        HttpResponse.json({
          providers: [{ id: PROVIDER, name: 'Composio', displayName: 'Composio' }],
        }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/toolkits`, () =>
        HttpResponse.json({ data: [{ slug: TOOLKIT, name: 'Gmail' }] }),
      ),
      http.get(`${BASE_URL}/api/tool-providers/${PROVIDER}/connections`, () =>
        HttpResponse.json({
          items: [
            { connectionId: 'conn_a', status: 'active', authorId: 'user_A', label: 'A' },
            { connectionId: 'conn_b', status: 'active', authorId: 'user_B', label: 'B' },
          ],
        }),
      ),
    );

    const { findByTestId, findByLabelText, findByRole } = render(
      <Wrap>
        <IntegrationsPage />
      </Wrap>,
    );

    // Pick provider, then toolkit, so the list query fires.
    // Wait for providers to finish loading so the select is enabled.
    await waitFor(async () => {
      const ps = (await findByLabelText('Provider')) as HTMLSelectElement;
      expect(ps.disabled).toBe(false);
      expect(ps.querySelector(`option[value="${PROVIDER}"]`)).not.toBeNull();
    });
    fireEvent.change(await findByLabelText('Provider'), { target: { value: PROVIDER } });

    // Wait for toolkit options to populate (toolkitsQuery resolves).
    await waitFor(
      async () => {
        const ts = (await findByLabelText('Toolkit')) as HTMLSelectElement;
        expect(ts.querySelector(`option[value="${TOOLKIT}"]`)).not.toBeNull();
      },
      { timeout: 3000 },
    );
    fireEvent.change(await findByLabelText('Toolkit'), { target: { value: TOOLKIT } });
    void findByRole;

    // Admin grouping headings appear.
    const groupA = await findByTestId('integration-author-group-user_A');
    expect(groupA.textContent).toContain('Owned by user_A');
    const groupB = await findByTestId('integration-author-group-user_B');
    expect(groupB.textContent).toContain('Owned by user_B');
  });
});
