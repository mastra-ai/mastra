// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import { Link as RouterLink, MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { LinkComponentProvider, type LinkComponentProps } from '@/lib/framework';
import Workspaces from '../index';
import { emptyWorkspaces, twoWorkspaces } from './fixtures/workspaces';

const BASE_URL = 'http://localhost:4111';

const Link = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href = '', ...props }, ref) => (
  <RouterLink ref={ref} to={href} {...props} />
));
Link.displayName = 'TestLink';

const paths = {
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
} as unknown as React.ComponentProps<typeof LinkComponentProvider>['paths'];

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
            <Workspaces />
          </LinkComponentProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('Workspaces list page', () => {
  it('renders a row per workspace linking to the editor route', async () => {
    server.use(http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(twoWorkspaces)));

    renderPage();

    const globalRow = await screen.findByText('Global Workspace');
    const agentRow = await screen.findByText('Agent Workspace');

    expect(globalRow.closest('a')?.getAttribute('href')).toBe('/workspaces/global-ws');
    expect(agentRow.closest('a')?.getAttribute('href')).toBe('/workspaces/agent-ws');
  });

  it('shows the attached agent name for agent workspaces', async () => {
    server.use(http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(twoWorkspaces)));

    renderPage();

    expect(await screen.findByText('Weather Agent')).not.toBeNull();
  });

  it('filters rows via the list search', async () => {
    server.use(http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(twoWorkspaces)));

    renderPage();

    await screen.findByText('Global Workspace');

    const search = screen.getByRole('textbox');
    fireEvent.change(search, { target: { value: 'agent' } });

    await waitFor(() => expect(screen.queryByText('Global Workspace')).toBeNull());
    expect(screen.getByText('Agent Workspace')).not.toBeNull();
  });

  it('renders the empty state when there are no workspaces', async () => {
    server.use(http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(emptyWorkspaces)));

    renderPage();

    expect(await screen.findByText('No Workspaces yet')).not.toBeNull();
  });

  it('shows session expired on 401', async () => {
    server.use(http.get(`${BASE_URL}/api/workspaces`, () => new HttpResponse(null, { status: 401 })));

    renderPage();

    expect(await screen.findByRole('heading', { name: /session expired/i })).not.toBeNull();
  });

  it('shows permission denied on 403', async () => {
    server.use(http.get(`${BASE_URL}/api/workspaces`, () => new HttpResponse(null, { status: 403 })));

    renderPage();

    await waitFor(() => expect(document.body.textContent).toMatch(/permission|access/i));
  });
});
