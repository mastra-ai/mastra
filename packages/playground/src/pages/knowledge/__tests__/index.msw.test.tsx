import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import KnowledgePage from '..';
import { demoScopes, noScopes } from './fixtures/knowledge-scopes';
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

const LocationProbe = () => <output data-testid="location-search">{useLocation().search}</output>;

const renderPage = (entry = '/knowledge') =>
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} navigate={() => {}} paths={stubLinkPaths}>
        <Routes>
          <Route
            path="/knowledge"
            element={
              <>
                <KnowledgePage />
                <LocationProbe />
              </>
            }
          />
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

  it('explains how to opt into the routes when the server does not register them', async () => {
    // The Knowledge routes are opt-in, so a server that has not registered them answers 404.
    server.use(
      http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ error: 'Not found' }, { status: 404 })),
    );
    renderPage();
    expect(await screen.findByText('Knowledge browsing is not enabled')).toBeTruthy();
  });

  it('keeps the scope form when the server refuses a scope tag', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ instances: [{ key: 'main', id: 'kb' }] })),
      http.get(`${TEST_BASE_URL}/api/knowledge/main/scopes`, () => HttpResponse.json(noScopes)),
      http.get(`${TEST_BASE_URL}/api/knowledge/main/graph`, () =>
        HttpResponse.json({ error: 'outside the caller scope' }, { status: 403 }),
      ),
    );
    renderPage('/knowledge?scope=org:acme');
    expect(await screen.findByText('That scope is not available to you')).toBeTruthy();
    expect(screen.getByLabelText('Scope tags')).toBeTruthy();
    expect(screen.queryByText(/Permission Denied/i)).toBeNull();
  });

  it('asks for a scope before reading anything', async () => {
    let graphRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ instances: [{ key: 'main', id: 'kb' }] })),
      http.get(`${TEST_BASE_URL}/api/knowledge/main/scopes`, () => HttpResponse.json(noScopes)),
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
      http.get(`${TEST_BASE_URL}/api/knowledge/main/scopes`, () => HttpResponse.json(noScopes)),
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

describe('Knowledge scope navigator', () => {
  describe('when the server lists the stored scope tag sets', () => {
    const graphScopes: string[][] = [];
    const useDemoScopes = () => {
      graphScopes.length = 0;
      server.use(
        http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ instances: [{ key: 'main', id: 'kb' }] })),
        http.get(`${TEST_BASE_URL}/api/knowledge/main/scopes`, () => HttpResponse.json(demoScopes)),
        http.get(`${TEST_BASE_URL}/api/knowledge/main/graph`, ({ request }) => {
          graphScopes.push(new URL(request.url).searchParams.getAll('scope'));
          return HttpResponse.json(graph);
        }),
      );
    };
    const clickSet = async (name: RegExp) => {
      const nav = await screen.findByRole('navigation', { name: 'Knowledge scopes' });
      fireEvent.click(within(nav).getByRole('button', { name }));
      return nav;
    };

    it('rewrites the scope params in the URL to the clicked set', async () => {
      useDemoScopes();
      renderPage('/knowledge?scope=org:acme');
      await clickSet(/^team:MOB/);

      await waitFor(() =>
        expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').getAll('scope')).toEqual([
          'org:local',
          'resource:studio-demo',
          'team:MOB',
        ]),
      );
    });

    it('reads the graph through the clicked set', async () => {
      useDemoScopes();
      renderPage();
      await clickSet(/^team:MOB/);

      await waitFor(() => expect(graphScopes.at(-1)).toEqual(['org:local', 'resource:studio-demo', 'team:MOB']));
    });

    it('marks the clicked set current and copies its tags into the scope box', async () => {
      useDemoScopes();
      renderPage();
      const nav = await clickSet(/^team:MOB/);

      await waitFor(() =>
        expect(
          within(nav)
            .getByRole('button', { name: /^team:MOB/ })
            .getAttribute('aria-current'),
        ).toBe('true'),
      );
      expect((screen.getByLabelText('Scope tags') as HTMLInputElement).value).toBe(
        'org:local resource:studio-demo team:MOB',
      );
    });

    it('marks the matching set when the same tags are typed into the scope box', async () => {
      useDemoScopes();
      renderPage();
      const nav = await screen.findByRole('navigation', { name: 'Knowledge scopes' });
      fireEvent.change(screen.getByLabelText('Scope tags'), {
        target: { value: 'team:LEE, resource:studio-demo org:local' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'View' }));

      await waitFor(() =>
        expect(
          within(nav)
            .getByRole('button', { name: /^team:LEE/ })
            .getAttribute('aria-current'),
        ).toBe('true'),
      );
      expect(graphScopes.at(-1)).toEqual(['team:LEE', 'resource:studio-demo', 'org:local']);
    });

    it('offers the union of every set as one view', async () => {
      useDemoScopes();
      renderPage();
      await clickSet(/^All scopes/);

      await waitFor(() =>
        expect(graphScopes.at(-1)).toEqual(['org:local', 'resource:studio-demo', 'team:LEE', 'team:MOB']),
      );
    });

    it('marks the set matching the scope already in the URL', async () => {
      useDemoScopes();
      renderPage('/knowledge?scope=org:local&scope=resource:studio-demo');
      const nav = await screen.findByRole('navigation', { name: 'Knowledge scopes' });
      expect(within(nav).getByRole('button', { name: /^Base/ }).getAttribute('aria-current')).toBe('true');
    });
  });

  describe('when the server refuses the scope list', () => {
    it('still browses by typed scope tags', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/api/knowledge`, () => HttpResponse.json({ instances: [{ key: 'main', id: 'kb' }] })),
        http.get(`${TEST_BASE_URL}/api/knowledge/main/scopes`, () =>
          HttpResponse.json({ error: 'not bound' }, { status: 403 }),
        ),
      );
      renderPage();
      expect(await screen.findByText('Choose a scope')).toBeTruthy();
      expect(screen.getByLabelText('Scope tags')).toBeTruthy();
      expect(screen.queryByRole('navigation', { name: 'Knowledge scopes' })).toBeNull();
    });
  });
});
