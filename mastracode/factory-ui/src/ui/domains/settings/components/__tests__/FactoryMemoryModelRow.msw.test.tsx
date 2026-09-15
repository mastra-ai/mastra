import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { OMConfigInfo } from '../../../../../api/types';
import type { AvailableModelOption } from '../../../../../hooks/useAvailableModels';
import { FactoryMemoryModelRow } from '../FactoryMemoryModelRow';

const models: AvailableModelOption[] = [
  { id: 'openai/gpt-5.4-mini', provider: 'openai', modelName: 'gpt-5.4-mini', hasApiKey: true },
];

const factoryConfig: OMConfigInfo = {
  observerModelId: 'openai/gpt-5.4-mini',
  reflectorModelId: 'openai/gpt-5.4-mini',
  observationThreshold: 30000,
  reflectionThreshold: 40000,
  observeAttachments: 'auto',
};

function stubFactoryOM(config: OMConfigInfo, seen: string[] = []) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/config/om`, ({ request }) => {
      seen.push(new URL(request.url).search);
      return HttpResponse.json({ config });
    }),
  );
}

function renderRow() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/models']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/models" element={<FactoryMemoryModelRow models={models} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FactoryMemoryModelRow', () => {
  it('shows the models Factory runs summarize with, read from the Factory-wide row', async () => {
    const seen: string[] = [];
    stubFactoryOM(factoryConfig, seen);

    renderRow();

    expect(await screen.findByText('Observer')).toBeInTheDocument();
    expect(screen.getAllByText('openai/gpt-5.4-mini')).toHaveLength(2);
    expect(seen).toEqual(['?factoryId=fp-1']);
    expect(screen.getByRole('link', { name: 'Memory settings' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/memory?scope=factory',
    );
    expect(screen.queryByText('Model credentials required')).not.toBeInTheDocument();
  });

  it('flags a memory model no connected provider serves', async () => {
    stubFactoryOM({ ...factoryConfig, reflectorModelId: 'google/gemini-3.5-flash' });

    renderRow();

    expect(await screen.findByText('Model credentials required')).toBeInTheDocument();
  });
});
