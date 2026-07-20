/**
 * BDD coverage for the propless `FactorySwitcher` (`domains/workspaces/components`).
 *
 * The switcher reads the active factory from `useActiveFactoryContext` and
 * drives the factories modal through `useOverlays` — no props. Opening the
 * factories overlay also closes the sidebar drawer (mobile behavior).
 */
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { OverlaysProvider, useOverlays } from '../../../../lib/overlays';
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
});

function seedFactory(project: Factory = PROJECT) {
  localStorage.setItem('mastracode-factories', JSON.stringify([project]));
  localStorage.setItem('mastracode-active-factory', project.id);
}

function OverlayProbe() {
  const overlays = useOverlays();
  return (
    <div>
      <span data-testid="projects-open">{overlays.isOpen('factories') ? 'yes' : 'no'}</span>
      <span data-testid="sidebar-open">{overlays.isOpen('sidebar') ? 'yes' : 'no'}</span>
      <button onClick={() => overlays.open('sidebar')}>open sidebar</button>
    </div>
  );
}

function renderSwitcher() {
  return renderWithProviders(
    <ActiveFactoryProvider>
      <OverlaysProvider>
        <FactorySwitcher />
        <OverlayProbe />
      </OverlaysProvider>
    </ActiveFactoryProvider>,
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

  it('when the switcher is clicked, then the inline project menu opens without opening the project picker', async () => {
    seedFactory();
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'Select factory' }));

    expect(await screen.findByRole('menuitem', { name: /MastraCode Test/ })).toBeInTheDocument();
    expect(screen.getByTestId('projects-open')).toHaveTextContent('no');
  });

  it('when Create factory from local folder is selected, then the factories overlay opens', async () => {
    seedFactory();
    renderSwitcher();

    await userEvent.click(screen.getByRole('button', { name: 'Select factory' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Create factory from local folder' }));

    expect(screen.getByTestId('projects-open')).toHaveTextContent('yes');
  });
});
