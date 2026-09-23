import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../api/types';
import { FactoryBoardLanding } from './FactoryBoardLanding';

function Destination() {
  return <p>{useLocation().pathname}</p>;
}
function renderLanding() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<FactoryBoardLanding factoryId="project-1" />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}
const endpoint = `${TEST_BASE_URL}/web/factory/projects/project-1/boards`;

describe('installed board landing', () => {
  it.each(['release', 'work', 'review'])('redirects to installed %s board preserving built-in URLs', async id => {
    const payload: BoardCatalogResponse = { boards: [{ id, title: id, initialPhase: 'queued', phases: [] }] };
    server.use(http.get(endpoint, () => HttpResponse.json(payload)));
    renderLanding();
    expect(await screen.findByText(`/factories/project-1/${id === 'release' ? 'boards/release' : id}`)).toBeTruthy();
  });
  it('shows empty installations without redirecting to Work', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ boards: [] } satisfies BoardCatalogResponse)));
    renderLanding();
    expect(await screen.findByText('No boards installed.')).toBeTruthy();
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
    expect(screen.getByRole('status').textContent).toBe('Loading boards…');
    release();
    expect((await screen.findByRole('alert')).textContent).toBe('Unable to load boards.');
  });
});
