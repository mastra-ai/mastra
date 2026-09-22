import { screen } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders, waitForMutationsIdle } from '../../../../../../e2e/ui/render';
import { FactoryPage } from '../FactoryPage';

const FACTORY_ID = 'fp-1';

function renderPage(factoryId = FACTORY_ID) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/overview`]}>
      <Routes>
        <Route
          path="/factories/:factoryId/overview"
          element={<FactoryPage>{factory => <p>Body for {factory.name}</p>}</FactoryPage>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FactoryPage', () => {
  describe('when the factory query is pending', () => {
    it('renders a spinner instead of the body', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects`, async () => {
          await delay('infinite');
          return HttpResponse.json({ projects: [] });
        }),
      );
      renderPage();
      expect(await screen.findByRole('status')).toBeInTheDocument();
      expect(screen.queryByText(/Body for/)).not.toBeInTheDocument();
    });
  });

  describe('when the factory is missing', () => {
    it('renders the not-found notice', async () => {
      server.use(http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: [] })));
      const { client } = renderPage('fp-missing');
      await waitForMutationsIdle(client);
      expect(await screen.findByText('Factory not found.')).toBeInTheDocument();
    });
  });

  describe('when the factory loads', () => {
    it('renders the body with the factory', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
          HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme' }] }),
        ),
      );
      renderPage();
      expect(await screen.findByText('Body for Acme')).toBeInTheDocument();
    });
  });
});
