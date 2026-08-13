import { MainSidebarProvider } from '@mastra/playground-ui/components/MainSidebar';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { FactorySwitcher } from '../FactorySwitcher';
import { factorySwitcherProjects } from './fixtures/factorySwitcher';

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () => HttpResponse.json({ projects: factorySwitcherProjects })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/:factoryProjectId/source-control-connections`, () =>
      HttpResponse.json({ connections: [] }),
    ),
  );
});

function renderFactorySwitcher(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/factories/:factoryId/*',
        element: (
          <MainSidebarProvider storageKey="factory-switcher-navigation" mobileBreakpoint={768}>
            <FactorySwitcher />
          </MainSidebarProvider>
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );
  renderWithProviders(<RouterProvider router={router} />);
  return {
    currentLocation: () => {
      const { pathname, search, hash } = router.state.location;
      return `${pathname}${search}${hash}`;
    },
  };
}

async function switchToNextFactory() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Select factory' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Next Factory' }));
}

describe('Factory switch navigation', () => {
  describe('when switching from a factory board tab', () => {
    it.each([
      {
        tab: 'work',
        initialEntry: '/factories/factory-current/work?status=ready#done',
        expectedLocation: '/factories/factory-next/work?status=ready#done',
      },
      {
        tab: 'review',
        initialEntry: '/factories/factory-current/review?status=open#queue',
        expectedLocation: '/factories/factory-next/review?status=open#queue',
      },
    ])('keeps the $tab location', async ({ initialEntry, expectedLocation }) => {
      const { currentLocation } = renderFactorySwitcher(initialEntry);

      await switchToNextFactory();

      expect(currentLocation()).toBe(expectedLocation);
    });
  });

  describe('when switching from a factory-scoped session', () => {
    it.each([
      {
        session: 'review',
        initialEntry:
          '/factories/factory-current/workspaces/review-session/threads/review-thread?resourceId=review#messages',
      },
      {
        session: 'user',
        initialEntry: '/factories/factory-current/user/threads/user-thread?resourceId=user#messages',
      },
    ])('opens the destination overview from a $session session', async ({ initialEntry }) => {
      const { currentLocation } = renderFactorySwitcher(initialEntry);

      await switchToNextFactory();

      expect(currentLocation()).toBe('/factories/factory-next/overview');
    });
  });
});
