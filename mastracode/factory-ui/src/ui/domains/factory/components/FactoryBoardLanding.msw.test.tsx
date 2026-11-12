import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../api/types';
import { OverlaysProvider } from '../../../lib/overlays';
import { FactoryBoardLanding } from './FactoryBoardLanding';

function Destination() {
  const location = useLocation();
  return <p>{`${location.pathname}${location.search}`}</p>;
}
function renderLanding() {
  return renderWithProviders(
    <Sidebar.Provider storageKey="board-landing-test" collapsedWidth={0}>
      <OverlaysProvider>
        <MemoryRouter initialEntries={['/factories/project-1']}>
          <Routes>
            <Route path="/factories/:factoryId" element={<FactoryBoardLanding factoryId="project-1" />} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </OverlaysProvider>
    </Sidebar.Provider>,
  );
}
const endpoint = `${TEST_BASE_URL}/web/factory/projects/project-1/boards`;

describe('installed board landing', () => {
  it.each(['release', 'work'])('redirects to installed %s board preserving built-in URLs', async id => {
    const payload: BoardCatalogResponse = { boards: [{ id, name: id, title: id, initialPhase: 'queued', phases: [] }] };
    server.use(http.get(endpoint, () => HttpResponse.json(payload)));
    renderLanding();
    expect(await screen.findByText(`/factories/project-1/${id === 'release' ? 'boards/release' : id}`)).toBeTruthy();
  });
  it('shows empty installations without redirecting to Work', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ boards: [] } satisfies BoardCatalogResponse)));
    renderLanding();
    expect(await screen.findByText('No boards installed.')).toBeTruthy();
  });
  it('keeps a way to reopen a collapsed sidebar while no board is installed', async () => {
    window.localStorage.setItem('board-landing-test:sidebar:state', 'collapsed');
    server.use(http.get(endpoint, () => HttpResponse.json({ boards: [] } satisfies BoardCatalogResponse)));
    renderLanding();
    await screen.findByText('No boards installed.');

    const toggle = screen.getByRole('button', { name: 'Toggle sidebar' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle);

    expect(screen.queryByRole('button', { name: 'Toggle sidebar' })).toBeNull();
    window.localStorage.removeItem('board-landing-test:sidebar:state');
  });
  it('shows loading then an honest catalog error', async () => {
    let release = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.get(endpoint, async () => {
        await gate;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    renderLanding();
    expect(screen.getByRole('status', { name: 'Loading boards' })).toBeInTheDocument();
    release();
    expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t load boards');
  });

  it('brings the boards back with Try again after a failed load, without reloading the page', async () => {
    let calls = 0;
    server.use(
      http.get(endpoint, () =>
        ++calls === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({
              boards: [{ id: 'work', name: 'Work', title: 'Work', initialPhase: 'queued', phases: [] }],
            }),
      ),
    );
    renderLanding();
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('/factories/project-1/work')).toBeTruthy();
  });

  // Which failure it was decides what a person can do about it, so each one gets its own art and next step.
  it.each([
    [
      'the server errors',
      () => new HttpResponse(null, { status: 500 }),
      'server-error',
      'The server returned an error.',
    ],
    ['the server is unreachable', () => HttpResponse.error(), 'disconnected', 'The server could not be reached.'],
    [
      'the factory is not in the organization',
      () => HttpResponse.json({ error: 'Project not found' }, { status: 404 }),
      'not-a-member',
      'This factory isn’t in your organization.',
    ],
    ['requests are rate limited', () => new HttpResponse(null, { status: 429 }), 'rate-limited', 'Too many requests.'],
  ])('explains a failed load when %s', async (_case, respond, art, description) => {
    server.use(http.get(endpoint, respond));
    const { container } = renderLanding();

    await screen.findByRole('alert');
    expect(screen.getByText(new RegExp(`^${description}`))).toBeInTheDocument();
    expect(container.querySelector('[data-illustration]')?.getAttribute('data-illustration')).toBe(art);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('sends an expired session to sign in, and back to this factory after, instead of a retry that would fail again', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ error: 'unauthorized' }, { status: 401 })));
    renderLanding();

    await screen.findByRole('alert');
    expect(screen.getByText('Your session expired. Sign in again to continue.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();

    await userEvent.click(screen.getByRole('link', { name: 'Sign in' }));

    expect(await screen.findByText('/signin?returnTo=%2Ffactories%2Fproject-1')).toBeInTheDocument();
  });
});
