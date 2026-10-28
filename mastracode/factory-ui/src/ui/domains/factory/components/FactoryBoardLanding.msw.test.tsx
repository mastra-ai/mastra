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
  return <p>{useLocation().pathname}</p>;
}
function renderLanding() {
  return renderWithProviders(
    <Sidebar.Provider storageKey="board-landing-test" collapsedWidth={0}>
      <OverlaysProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<FactoryBoardLanding factoryId="project-1" />} />
            <Route path="*" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </OverlaysProvider>
    </Sidebar.Provider>,
  );
}
const endpoint = `${TEST_BASE_URL}/web/factory/projects/project-1/boards`;

describe('installed board landing', () => {
  it.each(['release', 'work', 'review'])('redirects to installed %s board preserving built-in URLs', async id => {
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
    expect((await screen.findByRole('alert')).textContent).toBe('Unable to load boards.');
  });
});
