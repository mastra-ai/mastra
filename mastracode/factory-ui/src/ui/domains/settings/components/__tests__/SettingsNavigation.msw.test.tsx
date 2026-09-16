import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import { SettingsNavigation } from '../SettingsNavigation';
import { renderWithProviders } from '../../../../../../e2e/ui/render';

const STORAGE_KEY = 'settings-navigation-test';

function renderNavigation() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/factories/fp-1/settings/preferences']}>
      <MainSidebarProvider storageKey={STORAGE_KEY} mobileBreakpoint={0}>
        <Routes>
          <Route path="/factories/:factoryId/settings/:section" element={<SettingsNavigation />} />
        </Routes>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

afterEach(() => window.localStorage.removeItem(STORAGE_KEY));

describe('SettingsNavigation', () => {
  it('links to My account settings', () => {
    renderNavigation();

    expect(screen.getByRole('link', { name: 'My account' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/account',
    );
  });

  it('orders personal, agent, source, and Factory management settings by task', () => {
    renderNavigation();

    expect(screen.getByRole('link', { name: 'Manage Factory' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/factory',
    );
    expect(screen.getByRole('region', { name: 'Manage Factory' })).toBeInTheDocument();

    expect(screen.getAllByRole('link').map(link => link.textContent)).toEqual([
      'My account',
      'Preferences',
      'Models',
      'Memory',
      'Skills',
      'Behavior',
      'Repositories',
      'Work Intake',
      'Connections',
      'Manage Factory',
    ]);

    const sources = screen.getByRole('region', { name: 'Sources' });
    expect(within(sources).getByRole('link', { name: 'Connections' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/connections',
    );
    expect(within(sources).getByRole('link', { name: 'Repositories' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/repositories',
    );
    expect(within(sources).getByRole('link', { name: 'Work Intake' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/intake',
    );
    expect(
      within(sources)
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual(['Repositories', 'Work Intake', 'Connections']);

    const agent = screen.getByRole('region', { name: 'Agent' });
    expect(within(agent).getByRole('link', { name: 'Models' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models',
    );
    expect(within(agent).getByRole('link', { name: 'Behavior' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/behavior',
    );
    expect(screen.queryByRole('link', { name: 'Custom' })).not.toBeInTheDocument();
  });

  it('keeps legacy terms searchable while showing the clearer destination label', async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'source control');

    expect(screen.getByRole('link', { name: 'Repositories' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Work Intake' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Agent' })).not.toBeInTheDocument();
  });
});
