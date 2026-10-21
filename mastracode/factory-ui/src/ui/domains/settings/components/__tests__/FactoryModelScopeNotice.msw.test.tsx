import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { FactoryModelScopeNotice } from '../FactoryModelScopeNotice';

const NOTICE_TITLE = 'This Factory uses organization credentials only';
const NOTICE = "Sessions in this Factory don't use your personal provider sign-ins or default model.";

function renderNotice(modelScope: 'factory' | 'user') {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, user: { id: 'user-1', organizationId: 'org-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/fp-1`, () =>
      HttpResponse.json({ project: { id: 'fp-1', name: 'Mastra', modelScope } }),
    ),
  );
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/personal-models']}>
      <Routes>
        <Route path="/factories/:factoryId/settings/personal-models" element={<FactoryModelScopeNotice />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  delete window.__MASTRACODE_CONFIG__;
  server.events.removeAllListeners('response:mocked');
});

describe('FactoryModelScopeNotice', () => {
  it('explains that personal credentials are unused in an organization-scoped Factory', async () => {
    window.__MASTRACODE_CONFIG__ = { authEnabled: true };
    renderNotice('factory');

    const notice = await screen.findByRole('note');
    expect(notice).toHaveTextContent(NOTICE_TITLE);
    expect(notice).toHaveTextContent(NOTICE);
    expect(screen.getByRole('link', { name: 'Factory models settings' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models',
    );
  });

  it('stays hidden when the Factory uses personal credentials', async () => {
    window.__MASTRACODE_CONFIG__ = { authEnabled: true };
    const projectLoaded = new Promise<void>(resolve => {
      server.events.on('response:mocked', ({ request }) => {
        if (request.url.endsWith('/web/factory/projects/fp-1')) resolve();
      });
    });
    renderNotice('user');

    await projectLoaded;
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});
