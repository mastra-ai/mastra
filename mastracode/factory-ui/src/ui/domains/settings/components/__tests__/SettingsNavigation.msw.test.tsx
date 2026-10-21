import { SidebarProvider } from '@mastra/playground-ui/components/Sidebar';
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
      <SidebarProvider storageKey={STORAGE_KEY} mobileBreakpoint={0}>
        <Routes>
          <Route path="/factories/:factoryId/settings/:section" element={<SettingsNavigation />} />
        </Routes>
      </SidebarProvider>
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

  it('separates personal destinations from shared Factory settings', () => {
    renderNavigation();

    const personal = screen.getByRole('region', { name: 'Your settings' });
    const factory = screen.getByRole('region', { name: 'Factory settings' });
    expect(
      within(personal)
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual(['My account', 'Preferences', 'Your models', 'Your memory', 'Connections']);
    expect(
      within(factory)
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual([
      'Factory models',
      'Factory memory',
      'Skills',
      'Behavior',
      'Repositories',
      'Environment',
      'Work Intake',
      'Manage Factory',
    ]);
    expect(within(personal).getByRole('link', { name: 'Your models' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/personal-models',
    );
    expect(within(personal).getByRole('link', { name: 'Your memory' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/memory',
    );
    expect(within(factory).getByRole('link', { name: 'Factory models' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/models',
    );
    expect(within(factory).getByRole('link', { name: 'Factory memory' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/factory-memory',
    );
    expect(within(factory).getByRole('link', { name: 'Environment' })).toHaveAttribute(
      'href',
      '/factories/fp-1/settings/environment',
    );
  });

  it('keeps legacy terms searchable while showing the clearer destination label', async () => {
    const user = userEvent.setup();
    renderNavigation();

    await user.type(screen.getByRole('searchbox', { name: 'Search settings' }), 'source control');

    expect(screen.getByRole('link', { name: 'Repositories' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Work Intake' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your settings' })).not.toBeInTheDocument();
  });
});
