/**
 * BDD coverage for the propless `FactorySwitcher` (`domains/workspaces/components`).
 *
 * The switcher reads the active Factory from context and navigates to the
 * dedicated `/factories/create` page for the Create Factory action. Opening it
 * also closes the mobile sidebar drawer.
 */
import { MainSidebarProvider, useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
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
  localStorage.setItem('mastracode-active-factory', project.id);
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

function renderSwitcher() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/new']}>
      <MainSidebarProvider storageKey="factory-switcher-test" mobileBreakpoint={768}>
        <ActiveFactoryProvider>
          <FactorySwitcher />
          <StateProbe />
        </ActiveFactoryProvider>
      </MainSidebarProvider>
    </MemoryRouter>,
  );
}

describe('FactorySwitcher', () => {
  it('given an active factory, then its name and path render', async () => {
    seedFactory();
    renderSwitcher();

    await waitFor(() => expect(screen.getByText('MastraCode Test')).toBeInTheDocument());
    expect(screen.getByText('/tmp/mastracode-test')).toBeInTheDocument();
  });

  it('given no selection, then the placeholder renders', () => {
    renderSwitcher();

    expect(screen.getByText('Select a factory…')).toBeInTheDocument();
  });

  it('when the switcher is clicked, then the inline project menu opens without navigating', async () => {
    seedFactory();
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'Select factory' }));

    expect(await screen.findByRole('menuitem', { name: /MastraCode Test/ })).toBeInTheDocument();
    expect(screen.getByTestId('pathname')).toHaveTextContent('/new');
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
