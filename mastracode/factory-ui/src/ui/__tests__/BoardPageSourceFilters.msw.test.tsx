import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import {
  closePropertiesMenus,
  openPropertiesMenu,
  openPropertySubmenu,
  togglePropertyOption,
} from '../../../e2e/ui/properties-menu';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import type { IntakeConfig, IntakeSourceBinding } from '../domains/factory/services/intake';
import { linearProjects, wireSourceCards } from './fixtures/boardSourceFilters';
import {
  docsWatchId,
  hostedCards,
  hostedProjects,
  hostedTeamId,
  otherHostedTeamId,
} from './fixtures/hostedLinearProjectFilters';
import { FACTORY_ID, stubWorkBoard } from './workBoardStubs';

function stubSources() {
  stubWorkBoard();
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: true, sourceIds: ['acme/app'] },
          linear: { enabled: true, sourceIds: ['linear-team:eng'] },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
      HttpResponse.json({
        bindings: [
          {
            integrationId: 'linear',
            sourceId: 'linear-team:eng',
            factoryProjectId: FACTORY_ID,
            board: 'work',
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/github/status`, () =>
      HttpResponse.json({ enabled: true, connected: true, installations: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: true, connected: true, workspace: null }),
    ),
    http.get(`${TEST_BASE_URL}/web/linear/projects`, () => HttpResponse.json({ projects: linearProjects })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: wireSourceCards }),
    ),
  );
}

function renderBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work${search}`] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function stubHostedSources() {
  stubSources();
  const config: Partial<IntakeConfig> = {
    github: { enabled: false, sourceIds: [] },
    linear: { enabled: true, sourceIds: [hostedTeamId, otherHostedTeamId] },
  };
  const bindings: IntakeSourceBinding[] = [hostedTeamId, otherHostedTeamId].map(sourceId => ({
    integrationId: 'linear',
    sourceId,
    factoryProjectId: FACTORY_ID,
    board: 'work',
  }));
  server.use(
    http.get(`${TEST_BASE_URL}/web/intake/config`, () => HttpResponse.json({ config })),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.get(`${TEST_BASE_URL}/web/linear/projects`, () => HttpResponse.json({ projects: hostedProjects })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: hostedCards }),
    ),
  );
}

async function selectMany(name: string, options: string[]) {
  const user = userEvent.setup();
  for (const option of options) await togglePropertyOption(user, 'Board properties', name, new RegExp(option));
}

async function saveAsView() {
  const user = userEvent.setup();
  await openPropertiesMenu(user, 'Board properties');
  await user.click(screen.getByRole('menuitem', { name: 'Save as view' }));
  await user.click(await screen.findByRole('button', { name: 'Save view' }));
}

async function intakeSourceOptions() {
  await openPropertySubmenu(userEvent.setup(), 'Board properties', 'Intake source');
  return screen.getAllByRole('menuitemcheckbox').map(option => option.textContent);
}

async function expectPortalView() {
  await screen.findByText('Portal: add account switcher');
  expect(within(screen.getByTestId('board-column-intake')).getByText('Portal: invite teammates')).toBeInTheDocument();
  expect(
    within(screen.getByTestId('board-column-planning')).getByText('Portal: workspace settings'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByTestId('board-column-execute')).getByText('Portal: member permissions'),
  ).toBeInTheDocument();
  for (const title of [
    'Billing: export invoices',
    'Billing: payment history',
    'Moved project card',
    'Unassigned project',
    'GitHub: update dependencies',
    'GitHub: improve error messages',
    'Manual follow-up',
  ]) {
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  }
}

describe('Board source and Linear project filters', () => {
  it('offers connected providers and Manual, but not unconnected sources', async () => {
    stubSources();
    const view = renderBoard();
    await waitForMutationsIdle(view.client);
    // Pull requests are offered while a code host is connected: they replace the retired Review board.
    expect(await intakeSourceOptions()).toEqual(['GitHub', 'Linear', 'Manual', 'Pull requests']);
  });

  it('shows Linear, Jira and incident.io cards without asking those providers for their issue lists', async () => {
    stubSources();
    const listRequests: string[] = [];
    const listed = (provider: string) => () => {
      listRequests.push(provider);
      return HttpResponse.json({ issues: [], nextCursor: null });
    };
    const filedBy = (integrationId: string, id: string, title: string) => ({
      ...wireSourceCards[0],
      id,
      title,
      externalSource: { integrationId, type: 'issue', externalId: `${integrationId}:${id}`, url: null },
    });
    server.use(
      http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
        HttpResponse.json({
          config: {
            github: { enabled: true, sourceIds: ['acme/app'] },
            linear: { enabled: true, sourceIds: ['linear-team:eng'] },
            jira: { enabled: true, sourceIds: ['10001'] },
            incidentio: { enabled: true, sourceIds: ['incidentio:follow-ups'] },
          },
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/intake/bindings`, () =>
        HttpResponse.json({
          bindings: [
            { integrationId: 'linear', sourceId: 'linear-team:eng', factoryProjectId: FACTORY_ID, board: 'work' },
            { integrationId: 'jira', sourceId: '10001', factoryProjectId: FACTORY_ID, board: 'work' },
            {
              integrationId: 'incidentio',
              sourceId: 'incidentio:follow-ups',
              factoryProjectId: FACTORY_ID,
              board: 'work',
            },
          ],
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/jira/status`, () =>
        HttpResponse.json({
          enabled: true,
          configured: true,
          mode: 'platform',
          site: null,
          sites: [],
          reason: 'ready',
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/incidentio/status`, () =>
        HttpResponse.json({ enabled: true, configured: true, mode: 'platform', reason: 'ready' }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/issues`, listed('linear')),
      http.get(`${TEST_BASE_URL}/web/jira/issues`, listed('jira')),
      http.get(`${TEST_BASE_URL}/web/incidentio/issues`, listed('incidentio')),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: [
            ...wireSourceCards,
            filedBy('jira', 'OPS-7', 'Jira: rotate signing keys'),
            filedBy('incidentio', 'INC-9', 'incident.io: add failover alert'),
          ],
        }),
      ),
    );

    const view = renderBoard();
    const intake = within(await screen.findByTestId('board-column-intake'));
    expect(await intake.findByText('Portal: add account switcher')).toBeInTheDocument();
    expect(intake.getByText('Jira: rotate signing keys')).toBeInTheDocument();
    expect(intake.getByText('incident.io: add failover alert')).toBeInTheDocument();
    await waitForMutationsIdle(view.client);
    expect(listRequests).toEqual([]);
  });

  it('keeps a saved filter on a disconnected source labelled and selectable', async () => {
    stubSources();
    const view = renderBoard('?source=gitlab');
    await waitForMutationsIdle(view.client);
    expect(await intakeSourceOptions()).toEqual(['GitHub', 'GitLab', 'Linear', 'Manual', 'Pull requests']);
    expect(screen.getByRole('menuitemcheckbox', { name: 'GitLab' })).toHaveAttribute('aria-checked', 'true');
  });

  it('offers only Manual when configured providers are disconnected', async () => {
    stubSources();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, installations: [] }),
      ),
      http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
        HttpResponse.json({ enabled: true, connected: false, workspace: null }),
      ),
    );
    const view = renderBoard();
    await waitForMutationsIdle(view.client);
    expect(await intakeSourceOptions()).toEqual(['Manual']);
  });

  describe('when a hosted Linear project is selected', () => {
    it('keeps matching cards across the board after saving and reloading the view', async () => {
      stubHostedSources();
      const first = renderBoard();
      await screen.findByText('DocsWatch: new documentation request');
      await waitForMutationsIdle(first.client);
      const user = userEvent.setup();
      await openPropertiesMenu(user, 'Board properties');
      expect(screen.queryByRole('menuitem', { name: /^Linear project/ })).not.toBeInTheDocument();
      await closePropertiesMenus(user);
      await selectMany('Intake source', ['Linear']);
      await selectMany('Linear project', ['DocsWatch']);
      expect(new URLSearchParams(first.router.state.location.search).get('linearProject')).toBe(docsWatchId);

      const expectDocsWatch = async () => {
        expect(await screen.findByText('DocsWatch: new documentation request')).toBeInTheDocument();
        expect(
          within(screen.getByTestId('board-column-planning')).getByText('Portal: workspace settings'),
        ).toBeInTheDocument();
        expect(
          within(screen.getByTestId('board-column-execute')).getByText('Portal: member permissions'),
        ).toBeInTheDocument();
        expect(screen.queryByText('Other workspace card')).not.toBeInTheDocument();
        expect(screen.queryByText('Unassigned project')).not.toBeInTheDocument();
        expect(screen.queryByText('Billing: payment history')).not.toBeInTheDocument();
      };
      await expectDocsWatch();
      await saveAsView();
      const viewId = new URLSearchParams(first.router.state.location.search).get('view');
      expect(viewId).toBeTruthy();
      first.unmount();
      const second = renderBoard(`?view=${viewId}`);
      await waitForMutationsIdle(second.client);
      await expectDocsWatch();
    });
  });

  it('filters cards across stages, then saves and reloads a project view', async () => {
    stubSources();
    const first = renderBoard();
    await screen.findByText('GitHub: update dependencies');
    await waitForMutationsIdle(first.client);
    await selectMany('Intake source', ['Linear']);
    await screen.findByText('Portal: add account switcher');
    expect(screen.queryByText('GitHub: update dependencies')).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub: improve error messages')).not.toBeInTheDocument();
    expect(screen.getByText('Billing: payment history')).toBeInTheDocument();
    expect(first.router.state.location.search).toContain('source=linear');
    await selectMany('Linear project', ['Customer Portal']);
    await expectPortalView();
    expect(first.router.state.location.search).toContain('linearProject=project-a');

    await saveAsView();
    const viewId = new URLSearchParams(first.router.state.location.search).get('view');
    expect(viewId).toBeTruthy();
    first.unmount();
    const second = renderBoard(`?view=${viewId}`);
    await waitForMutationsIdle(second.client);
    await expectPortalView();
  });

  it('restores a project-only URL and combines it with an existing label filter', async () => {
    stubSources();
    const view = renderBoard('?linearProject=project-a&label=feature');
    await waitForMutationsIdle(view.client);
    await expectPortalView();
    const user = userEvent.setup();
    await openPropertiesMenu(user, 'Board properties');
    expect(screen.getByRole('menuitem', { name: /^Linear project\s*Customer Portal$/ })).toBeInTheDocument();
    await closePropertiesMenus(user);
    await togglePropertyOption(user, 'Board properties', 'Linear project', 'Customer Portal');
    expect(view.router.state.location.search).not.toContain('linearProject=');
    expect(view.router.state.location.search).toContain('label=feature');
  });

  it('merges selected source feeds and restores all sources after clearing the filter', async () => {
    stubSources();
    const view = renderBoard();
    await screen.findByText('GitHub: update dependencies');
    await waitForMutationsIdle(view.client);
    await selectMany('Intake source', ['GitHub', 'Linear']);
    await screen.findByText('Portal: add account switcher');
    expect(screen.getByText('GitHub: update dependencies')).toBeInTheDocument();
    expect(screen.queryByText('Manual follow-up')).not.toBeInTheDocument();
    await selectMany('Intake source', ['GitHub', 'Linear']);
    await screen.findByText('Manual follow-up');
    expect(screen.getByText('Portal: add account switcher')).toBeInTheDocument();
    expect(view.router.state.location.search).not.toContain('source=');
  });

  it('matches any selected Linear project and narrows only Linear cards by it', async () => {
    stubSources();
    const first = renderBoard('?linearProject=project-a&linearProject=project-b');
    await waitForMutationsIdle(first.client);
    await screen.findByText('Portal: add account switcher');
    expect(screen.getByText('Billing: export invoices')).toBeInTheDocument();
    expect(screen.getByText('Moved project card')).toBeInTheDocument();
    expect(screen.queryByText('Unassigned project')).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub: update dependencies')).not.toBeInTheDocument();
    first.unmount();
    const second = renderBoard('?source=github&source=linear&linearProject=project-a');
    await waitForMutationsIdle(second.client);
    await screen.findByText('Portal: add account switcher');
    expect(screen.getByText('GitHub: update dependencies')).toBeInTheDocument();
    expect(screen.queryByText('Billing: export invoices')).not.toBeInTheDocument();
    expect(screen.queryByText('Manual follow-up')).not.toBeInTheDocument();
  });

  it('explains that filters excluded Intake cards instead of suggesting an integration setup', async () => {
    stubSources();
    const view = renderBoard('?source=jira');
    await waitForMutationsIdle(view.client);
    await within(screen.getByTestId('board-column-intake')).findByText('No work items match filters');
    expect(
      within(screen.getByTestId('board-column-intake')).getByText(/Try adjusting or clearing your filters\./),
    ).toBeInTheDocument();
    expect(screen.queryByText('No intake sources')).not.toBeInTheDocument();
  });
});
