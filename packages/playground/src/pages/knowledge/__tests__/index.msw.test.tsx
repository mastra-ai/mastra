import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import KnowledgePage from '..';
import { Link } from '@/lib/link';
import { stubLinkPaths } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const graph = {
  nodes: [
    {
      id: 'n1',
      name: 'Payments',
      kind: 'service',
      scope: ['org:acme'],
      rung: 'org',
      pinned: false,
      recordCount: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  edges: [],
  records: [{ id: 'r1', nodeIds: ['n1'], pinned: false, text: 'Payments is documented.' }],
  truncated: false,
  outOfWindow: [],
  unresolvedCapped: { count: 0, names: [] },
  pinCensus: { resource: 0, thread: 0 },
  version: null,
};

const renderPage = (entry = '/knowledge') =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route path="/knowledge" element={<KnowledgePage />} />
        </Routes>
      </LinkComponentProvider>
    </TooltipProvider>,
    { router: { initialEntries: [entry] } },
  );

describe('Knowledge page', () => {
  it('explains how to register Knowledge when the server has none', async () => {
    server.use(http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ instances: [] })));
    renderPage();
    expect(await screen.findByText('No Knowledge instances')).toBeTruthy();
  });

  it('asks for a scope before reading anything', async () => {
    let graphRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ instances: [{ key: 'main', id: 'kb' }] })),
      http.get(`${TEST_BASE_URL}/api/knowledge/main/graph`, () => {
        graphRequests += 1;
        return HttpResponse.json(graph);
      }),
    );
    renderPage();
    expect(await screen.findByText('Choose a scope')).toBeTruthy();
    expect(graphRequests).toBe(0);
  });

  it('reads the graph with the chosen scope tags and renders it', async () => {
    const graphScopes: string[][] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ instances: [{ key: 'main', id: 'kb' }] })),
      http.get(`${TEST_BASE_URL}/api/knowledge/main/graph`, ({ request }) => {
        graphScopes.push(new URL(request.url).searchParams.getAll('scope'));
        return HttpResponse.json(graph);
      }),
    );
    renderPage();

    fireEvent.change(await screen.findByLabelText('Scope tags'), { target: { value: 'org:acme, project:web' } });
    fireEvent.click(screen.getByRole('button', { name: 'View' }));

    await waitFor(() => expect(graphScopes[0]).toEqual(['org:acme', 'project:web']));
    expect(await screen.findByTestId('knowledge-graph-container')).toBeTruthy();
  });
});
