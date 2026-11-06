import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { ConnectionsSection } from '../ConnectionsSection';

describe('Connections settings', () => {
  it('lists your personal GitHub identity without organization connections', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({
          enabled: true,
          connected: true,
          installations: [{ installationId: 7, accountLogin: 'acme', accountType: 'Organization' }],
          userConnected: true,
          userGithubUsername: 'ada',
          reason: 'ready',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/channel-accounts`, () =>
        HttpResponse.json({ accounts: [], canConnect: false, reason: 'not_registered' }),
      ),
    );
    renderWithProviders(
      <MemoryRouter initialEntries={['/factories/fp-1/settings/connections']}>
        <Routes>
          <Route path="/factories/:factoryId/settings/connections" element={<ConnectionsSection />} />
        </Routes>
      </MemoryRouter>,
    );

    const personal = await screen.findByRole('region', { name: 'Connected accounts' });
    expect(await within(personal).findByText('@ada')).toBeInTheDocument();
    expect(screen.queryByText('acme')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage GitHub connection' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'GitHub CLI tokens' })).not.toBeInTheDocument();
  });
});
