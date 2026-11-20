import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog, workBoardInfo } from '../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../e2e/ui/render';
import type { BoardCatalogResponse } from '../../../../api/types';
import { OverlaysProvider } from '../../../lib/overlays';
import { FactorySection } from './FactorySection';

const endpoint = `${TEST_BASE_URL}/web/factory/projects/project-1/boards`;

function renderSidebar() {
  return renderWithProviders(
    <Sidebar.Provider storageKey="factory-section-test">
      <OverlaysProvider>
        <MemoryRouter initialEntries={['/factories/project-1/work']}>
          <Routes>
            <Route path="/factories/:factoryId/*" element={<FactorySection />} />
          </Routes>
        </MemoryRouter>
      </OverlaysProvider>
    </Sidebar.Provider>,
  );
}

describe('sidebar boards', () => {
  it('offers Retry when the boards fail to load, and lists them once the retry succeeds', async () => {
    let calls = 0;
    server.use(
      http.get(endpoint, () =>
        ++calls === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(builtinBoardCatalog),
      ),
    );
    renderSidebar();

    const boards = screen.getByRole('region', { name: 'Boards' });
    expect((await screen.findByRole('alert')).textContent).toContain('Couldn’t load boards');
    expect(screen.queryByRole('link', { name: workBoardInfo.title })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: workBoardInfo.title })).toBeInTheDocument();
    expect(boards).not.toContainElement(screen.queryByRole('alert'));
  });

  it('says so when the factory has no boards installed', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ boards: [] } satisfies BoardCatalogResponse)));
    renderSidebar();

    expect(await screen.findByText('No boards installed.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
