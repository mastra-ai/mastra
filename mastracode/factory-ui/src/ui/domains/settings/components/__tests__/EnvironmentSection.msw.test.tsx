import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { FactoryEnvironmentPayload } from '../../../workspaces/services/environment';
import { EnvironmentSection } from '../EnvironmentSection';
import { environmentPayload, FACTORY_ID } from './fixtures/environment';

const ENVIRONMENT_URL = `${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/environment`;

function useFactory() {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme' }] }),
    ),
  );
}

function useEnvironment(environment: FactoryEnvironmentPayload) {
  server.use(http.get(ENVIRONMENT_URL, () => HttpResponse.json({ environment })));
}

function renderEnvironmentSettings() {
  renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${FACTORY_ID}/settings/environment`]}>
      <Routes>
        <Route path="/factories/:factoryId/settings/environment" element={<EnvironmentSection />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Environment settings', () => {
  it('renders the section for the factory with its environment', async () => {
    useFactory();
    useEnvironment(environmentPayload());

    renderEnvironmentSettings();

    expect(await screen.findByRole('heading', { name: 'Environment' })).toBeInTheDocument();
    expect(await screen.findByText('2 of 2 linked repositories in the environment.')).toBeInTheDocument();
  });

  it('points to Repositories when nothing is linked yet', async () => {
    useFactory();
    useEnvironment(environmentPayload({ repositories: [] }));

    renderEnvironmentSettings();

    expect(await screen.findByText(/Link a repository first/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Repositories' })).toHaveAttribute(
      'href',
      `/factories/${FACTORY_ID}/settings/repositories`,
    );
  });

  it('shows the load failure instead of an empty page', async () => {
    useFactory();
    server.use(http.get(ENVIRONMENT_URL, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));

    renderEnvironmentSettings();

    expect(await screen.findByText('Failed to load environment (500)')).toBeInTheDocument();
  });
});
