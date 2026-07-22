/**
 * Regression: after creating a factory, the switcher must reflect it — both as
 * the active route factory and in its dropdown. `useCreateFactoryMutation`
 * refetches the factories query before the panel navigates to the new route.
 */
import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { ActiveFactoryProvider } from '../../context/ActiveFactoryProvider';
import { FactoriesPanel } from '../FactoriesPanel';
import { FactorySwitcher } from '../FactorySwitcher';

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.post(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ project: { id: 'fp-new', name: 'Fresh Factory' } }),
    ),
  );
});

afterEach(() => localStorage.clear());

function FactoryRouteHarness() {
  const { factoryId } = useParams<{ factoryId: string }>();
  return (
    <ActiveFactoryProvider factoryId={factoryId ?? 'missing-factory'}>
      <FactorySwitcher />
      <FactoriesPanel onClose={vi.fn()} />
    </ActiveFactoryProvider>
  );
}

describe('factory creation refresh', () => {
  it('the switcher lists the newly created factory', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/factories/create']}>
        <MainSidebarProvider storageKey="repro" mobileBreakpoint={768}>
          <Routes>
            <Route path="/factories/create" element={<FactoryRouteHarness />} />
            <Route path="/factories/:factoryId/*" element={<FactoryRouteHarness />} />
          </Routes>
        </MainSidebarProvider>
      </MemoryRouter>,
    );

    await user.type(await screen.findByLabelText('Factory name'), 'Fresh Factory');
    await user.click(screen.getByRole('button', { name: 'Create Factory' }));

    // Active factory shows in the trigger…
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Select factory' })).toHaveTextContent('Fresh Factory'),
    );

    // …and the dropdown lists it.
    await user.click(screen.getByRole('button', { name: 'Select factory' }));
    expect(await screen.findByRole('menuitem', { name: /Fresh Factory/ })).toBeInTheDocument();
  });
});
