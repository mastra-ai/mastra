/**
 * Regression: after creating a factory, the switcher must reflect it in its
 * dropdown. `useCreateFactoryMutation` refetches the factories query before the
 * wizard advances to the next step.
 */
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { CreateFactoryPage } from '../../../../pages/CreateFactoryPage';
import { FactorySwitcher } from '../FactorySwitcher';

let projectCreated = false;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  projectCreated = false;
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: projectCreated ? [{ id: 'fp-new', name: 'Fresh Factory' }] : [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-new/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects`, () => {
      projectCreated = true;
      return HttpResponse.json({ project: { id: 'fp-new', name: 'Fresh Factory' } });
    }),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: false, installations: [], reason: 'not_connected' }),
    ),
  );
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('factory creation refresh', () => {
  it('the switcher lists the newly created factory', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/factories/create']}>
        <MainSidebarProvider storageKey="repro" mobileBreakpoint={768}>
          <FactorySwitcher />
          <CreateFactoryPage />
        </MainSidebarProvider>
      </MemoryRouter>,
    );

    await user.type(await screen.findByLabelText('Factory name'), 'Fresh Factory');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    // The wizard advanced (factories query refetched before the step change)…
    expect(await screen.findByRole('heading', { name: 'Choose your codebase.' })).toBeInTheDocument();

    // …and the switcher dropdown lists the new factory.
    await user.click(screen.getByRole('button', { name: 'Select factory' }));
    expect(await screen.findByRole('menuitem', { name: /Fresh Factory/ })).toBeInTheDocument();
  });
});
