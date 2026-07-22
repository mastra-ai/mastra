/**
 * BDD coverage for the propless `FactorySwitcher` (`domains/workspaces/components`).
 *
 * The switcher reads the active Factory from context and navigates to the
 * dedicated `/factories/create` page for the Create Factory action. Opening it
 * also closes the mobile sidebar drawer.
 */
import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { ActiveFactoryProvider } from '../../context/ActiveFactoryProvider';
import type { Factory } from '../../services/factories';
import { FactorySwitcher } from '../FactorySwitcher';

const PROJECT: Factory = {
  id: 'project-test',
  name: 'MastraCode Test',
  resourceId: 'resource-test',
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/tmp/mastracode-test',
  },
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

function seedFactory(project: Factory = PROJECT) {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
}

function StateProbe() {
  const location = useLocation();
  const { openMobile, setOpenMobile } = useMainSidebar();
  return (
    <div>
      <output data-testid="pathname">{location.pathname}</output>
      <output data-testid="sidebar-open">{openMobile ? 'yes' : 'no'}</output>
      <button onClick={() => setOpenMobile(true)}>Open mobile sidebar</button>
    </div>
  );
}

function renderSwitcher(factoryId = PROJECT.id) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[`/factories/${factoryId}/new`]}>
      <MainSidebarProvider storageKey="factory-switcher-test" mobileBreakpoint={768}>
        <ActiveFactoryProvider factoryId={factoryId}>
          <FactorySwitcher />
          <StateProbe />
        </ActiveFactoryProvider>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('FactorySwitcher', () => {
  it('given an active factory, then its name renders without its path in the trigger', async () => {
    seedFactory();
    renderSwitcher();

    await waitFor(() => expect(screen.getByText('MastraCode Test')).toBeInTheDocument());
    expect(screen.queryByText('/tmp/mastracode-test')).not.toBeInTheDocument();
  });

  it('given no selection, then the placeholder renders', () => {
    renderSwitcher();

    expect(screen.getByText('Select a factory…')).toBeInTheDocument();
  });

  it('when the switcher is clicked, then the menu shows each factory path without navigating', async () => {
    seedFactory();
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'Select factory' }));

    const factoryItem = await screen.findByRole('menuitem', { name: /MastraCode Test/ });
    expect(within(factoryItem).getByText('/tmp/mastracode-test')).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent(`/factories/${PROJECT.id}/new`);
  });

  it('when a server-backed Factory is selected from /new, then the user is taken to Work', async () => {
    const serverFactory: Factory = {
      id: 'server-factory',
      name: 'Server Factory',
      createdAt: 2,
      binding: {
        kind: 'factory',
        factoryProjectId: 'server-project',
        repositories: [],
      },
    };
    localStorage.setItem('mastracode-factories', JSON.stringify([PROJECT, serverFactory]));
    renderSwitcher();

    await userEvent.click(await screen.findByRole('button', { name: 'Select factory' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Server Factory/ }));

    await waitFor(() =>
      expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/server-factory/work'),
    );
  });

  it('when Create Factory is selected on mobile, then it navigates to /factories/create and the sidebar closes', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    seedFactory();
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'Open mobile sidebar' }));
    expect(screen.getByTestId('sidebar-open')).toHaveTextContent('yes');

    await userEvent.click(screen.getByRole('button', { name: 'Select factory' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Create Factory' }));

    expect(screen.getByTestId('pathname')).toHaveTextContent('/factories/create');
    expect(screen.getByTestId('sidebar-open')).toHaveTextContent('no');
  });
});
