import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { FactoryModelsSettings } from '../FactoryModelsSettings';

function renderModelsSettings() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/models']}>
      <Routes>
        <Route
          path="/factories/:factoryId/settings/models"
          element={<FactoryModelsSettings models={[]} settings={null} onBehaviorChange={() => Promise.resolve()} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FactoryModelsSettings', () => {
  it('given a connected provider, when thinking defaults render, then only the base level is offered even if an older server still lists modes', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
        HttpResponse.json({ providers: [{ provider: 'openai', source: 'stored-org', orgKey: true }] }),
      ),
      http.get(`${TEST_BASE_URL}/web/config/custom-providers`, () => HttpResponse.json({ providers: [] })),
      http.get(`${TEST_BASE_URL}/web/config/thinking`, () =>
        HttpResponse.json({
          globalDefault: 'off',
          modeDefaults: { plan: 'max' },
          modes: ['build', 'plan'],
          levels: ['off', 'low'],
          editable: true,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: 'factory' } }),
      ),
    );

    renderModelsSettings();

    expect(await screen.findByRole('slider', { name: 'Base thinking level' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: /mode thinking level/ })).not.toBeInTheDocument();
    expect(screen.getByText('Used by every run without its own level')).toBeInTheDocument();
  });

  it('keeps the model scope available when no provider is connected', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/config/providers`, () => HttpResponse.json({ providers: [] })),
      http.get(`${TEST_BASE_URL}/web/config/custom-providers`, () => HttpResponse.json({ providers: [] })),
      http.get(`${TEST_BASE_URL}/web/config/thinking`, () =>
        HttpResponse.json({ globalDefault: 'off', levels: ['off'], editable: false }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
        HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope: 'factory' } }),
      ),
    );

    renderModelsSettings();

    await waitFor(() => expect(screen.queryByText('Thinking defaults')).not.toBeInTheDocument());
    expect(screen.getByRole('combobox', { name: 'Model scope' })).toHaveTextContent('Factory model and credentials');
  });
});
