/**
 * Regression: the Factory is created on the wizard's last step, and the
 * switcher must list it right away — the factories query is invalidated before
 * the wizard hands over to the new Factory.
 */
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { CreateFactoryWizard } from '../create-factory/CreateFactoryWizard';
import { FactorySwitcher } from '../FactorySwitcher';

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

const repo = {
  id: 99,
  fullName: 'octo/hello',
  name: 'hello',
  owner: 'octo',
  defaultBranch: 'main',
  private: false,
  installationId: 7,
  installationStorageId: 'inst-7',
  sandboxProvider: 'local',
  sandboxWorkdir: '/workspace/hello',
};

let projectCreated = false;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  projectCreated = false;
  sessionStorage.setItem('mastracode.factory-create.step', 'model-provider');
  sessionStorage.setItem('mastracode.factory-create.name', 'Fresh Factory');
  sessionStorage.setItem('mastracode.factory-create.repository', JSON.stringify(repo));
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: projectCreated ? [{ id: 'fp-new', name: 'Fresh Factory' }] : [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects`, () => {
      projectCreated = true;
      return HttpResponse.json({ project: { id: 'fp-new', name: 'Fresh Factory' } });
    }),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-new`, () =>
      HttpResponse.json({ project: { id: 'fp-new', name: 'Fresh Factory' } }),
    ),
    http.patch(`${TEST_BASE_URL}/web/factory/projects/fp-new`, () =>
      HttpResponse.json({ project: { id: 'fp-new', name: 'Fresh Factory' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-new/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/fp-new/source-control-connections`, () =>
      HttpResponse.json({ connection: { id: 'conn-1' } }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/fp-new/source-control-connections/conn-1/repositories`, () =>
      HttpResponse.json({
        projectRepository: {
          id: 'ghp_1',
          branch: 'main',
          sandboxWorkdir: '/workspace/hello',
          repository: { slug: 'octo/hello', defaultBranch: 'main' },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/providers`, () =>
      HttpResponse.json({
        providers: [{ provider: 'anthropic', source: 'stored', oauth: { supported: true, modes: ['paste-code'] } }],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/config/models`, () =>
      HttpResponse.json({
        models: [
          { id: 'anthropic/claude-sonnet-4-5', provider: 'anthropic', modelName: 'claude-sonnet-4-5', hasApiKey: true },
        ],
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/config/om/provider-defaults`, () => HttpResponse.json({ ok: true, config: {} })),
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
      <MemoryRouter initialEntries={['/factories/fp-host/new-factory']}>
        <MainSidebarProvider storageKey="repro" mobileBreakpoint={768}>
          <FactorySwitcher />
          <Routes>
            <Route path="/factories/:factoryId/new-factory" element={<CreateFactoryWizard />} />
          </Routes>
        </MainSidebarProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('option', { name: /Anthropic/ }));
    await user.click(await screen.findByRole('option', { name: /anthropic\/claude-sonnet-4-5/ }));

    await user.click(await screen.findByRole('button', { name: 'Select factory' }));
    expect(await screen.findByRole('menuitem', { name: /Fresh Factory/ })).toBeInTheDocument();
  });
});
