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
import { githubIssue, linearIssue, linearIssues, linearProjects, wireSourceCards } from './fixtures/boardSourceFilters';
import {
  docsWatchId,
  hostedCards,
  hostedIssues,
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
    http.get(`${TEST_BASE_URL}/web/linear/issues`, () => HttpResponse.json({ issues: linearIssues, nextCursor: null })),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) =>
      HttpResponse.json({
        issues: new URL(request.url).searchParams.has('label') ? [] : [githubIssue],
        nextPage: null,
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: wireSourceCards }),
    ),
  );
}

function renderBoard(search = '') {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/work${search}`] });
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function stubHostedSources(issues = hostedIssues) {
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
    http.get(`${TEST_BASE_URL}/web/linear/issues`, () => HttpResponse.json({ issues, nextCursor: null })),
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
    expect(await intakeSourceOptions()).toEqual(['GitHub', 'Linear', 'Manual']);
  });

  it('keeps a saved filter on a disconnected source labelled and selectable', async () => {
    stubSources();
    const view = renderBoard('?source=gitlab');
    await waitForMutationsIdle(view.client);
    expect(await intakeSourceOptions()).toEqual(['GitHub', 'GitLab', 'Linear', 'Manual']);
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
    it('keeps matching live and stored cards across the board after saving and reloading the view', async () => {
      stubHostedSources();
      const first = renderBoard();
      await screen.findByText('DocsWatch: new documentation request');
      await waitForMutationsIdle(first.client);
      await selectMany('Linear project', ['DocsWatch']);
      expect(new URLSearchParams(first.router.state.location.search).get('linearProject')).toBe(docsWatchId);

      const expectDocsWatch = async () => {
        expect(await screen.findByText('DocsWatch: new documentation request')).toBeInTheDocument();
        expect(
          within(screen.getByTestId('board-column-planning')).getByText('DocsWatch: legacy planning card'),
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

  describe('when a hosted issue leaves its project', () => {
    it('excludes the stale stored project membership while retaining other matching cards', async () => {
      stubHostedSources([...hostedIssues, { ...linearIssue('ENG-104', null), sourceId: hostedTeamId }]);
      const view = renderBoard(`?linearProject=${encodeURIComponent(docsWatchId)}`);
      await waitForMutationsIdle(view.client);
      expect(await screen.findByText('DocsWatch: new documentation request')).toBeInTheDocument();
      expect(screen.queryByText('Portal: member permissions')).not.toBeInTheDocument();
    });
  });

  it('filters live Intake and stored cards across stages, then saves and reloads a project view', async () => {
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

  it('hides a repository-scoped candidate already filed with a legacy key when source filters combine feeds', async () => {
    stubSources();
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, ({ request }) =>
        HttpResponse.json({
          issues: new URL(request.url).searchParams.has('label') ? [] : [{ ...githubIssue, repositoryId: 987 }],
          nextPage: null,
        }),
      ),
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({
          workItems: wireSourceCards.map(item => {
            if (item.id !== '50' || !item.externalSource) return item;
            return {
              ...item,
              externalSource: { ...item.externalSource, externalId: 'github-issue:42', url: githubIssue.url },
            };
          }),
        }),
      ),
    );
    const view = renderBoard('?source=github&source=linear');
    await waitForMutationsIdle(view.client);
    await screen.findByText('Portal: add account switcher');
    expect(screen.getByText('GitHub: update dependencies')).toBeInTheDocument();
    expect(screen.queryByText('GitHub: improve error messages')).not.toBeInTheDocument();
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
    expect(screen.getByText('GitHub: improve error messages')).toBeInTheDocument();
    expect(screen.getByText('GitHub: update dependencies')).toBeInTheDocument();
    expect(screen.queryByText('Manual follow-up')).not.toBeInTheDocument();
    await selectMany('Intake source', ['GitHub', 'Linear']);
    await screen.findByText('Manual follow-up');
    expect(screen.getByText('Portal: add account switcher')).toBeInTheDocument();
    expect(view.router.state.location.search).not.toContain('source=');
  });

  it('keeps pagination available when the matching project is on a later page', async () => {
    stubSources();
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/issues`, ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.has('after')
            ? { issues: [linearIssue('ENG-105', 'project-a', 'Portal: later page')], nextCursor: null }
            : { issues: [linearIssues[1]], nextCursor: 'next-page' },
        ),
      ),
    );
    const { client } = renderBoard('?linearProject=project-a');
    await waitForMutationsIdle(client);
    fireEvent.click(await screen.findByRole('button', { name: 'Load more candidates' }));
    await screen.findByText('Portal: later page');
    expect(screen.queryByText('Billing: export invoices')).not.toBeInTheDocument();
  });
  it('pages a healthy feed without retrying a failed provider', async () => {
    stubSources();
    let githubAttempts = 0;
    let linearPageRequests = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, () => {
        githubAttempts++;
        return HttpResponse.json({ error: 'GitHub feed unavailable' }, { status: 502 });
      }),
      http.get(`${TEST_BASE_URL}/web/linear/issues`, ({ request }) => {
        if (new URL(request.url).searchParams.has('after')) {
          linearPageRequests++;
          return HttpResponse.json({
            issues: [linearIssue('ENG-105', 'project-a', 'Portal: later page')],
            nextCursor: null,
          });
        }
        return HttpResponse.json({ issues: [linearIssues[0]], nextCursor: 'next-page' });
      }),
    );

    renderBoard('?source=github&source=linear');
    await screen.findAllByText('GitHub: GitHub feed unavailable');
    await screen.findByText('Portal: add account switcher');
    const githubAttemptsBeforePaging = githubAttempts;
    fireEvent.click(await screen.findByRole('button', { name: 'Load more candidates' }));
    await screen.findByText('Portal: later page');
    expect(linearPageRequests).toBe(1);
    expect(githubAttempts).toBe(githubAttemptsBeforePaging);
    expect(screen.getAllByText('GitHub: GitHub feed unavailable')).not.toHaveLength(0);
  });

  it('retries a failed page in a combined feed without losing the other source cards', async () => {
    stubSources();
    let pageAttempts = 0;
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/issues`, ({ request }) => {
        if (!new URL(request.url).searchParams.has('after')) {
          return HttpResponse.json({ issues: [linearIssues[0]], nextCursor: 'next-page' });
        }
        pageAttempts += 1;
        if (pageAttempts === 1) return HttpResponse.json({ error: 'Linear page unavailable' }, { status: 502 });
        return HttpResponse.json({
          issues: [linearIssue('ENG-105', 'project-a', 'Portal: later page')],
          nextCursor: null,
        });
      }),
    );
    const view = renderBoard('?source=github&source=linear');
    await waitForMutationsIdle(view.client);
    await screen.findByText('Portal: add account switcher');
    fireEvent.click(await screen.findByRole('button', { name: 'Load more candidates' }));
    await screen.findByText('Linear: Linear page unavailable');
    expect(screen.getByText('GitHub: improve error messages')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('Portal: later page');
    expect(screen.getByText('Portal: add account switcher')).toBeInTheDocument();
    expect(screen.getByText('GitHub: improve error messages')).toBeInTheDocument();
    expect(screen.queryByText('Linear page unavailable')).not.toBeInTheDocument();
  });

  it('matches any selected Linear project and respects an incompatible source filter', async () => {
    stubSources();
    const first = renderBoard('?linearProject=project-a&linearProject=project-b');
    await waitForMutationsIdle(first.client);
    await screen.findByText('Portal: add account switcher');
    expect(screen.getByText('Billing: export invoices')).toBeInTheDocument();
    expect(screen.getByText('Moved project card')).toBeInTheDocument();
    expect(screen.queryByText('Unassigned project')).not.toBeInTheDocument();
    first.unmount();
    const second = renderBoard('?source=github&linearProject=project-a');
    await waitForMutationsIdle(second.client);
    expect(screen.queryByText('Portal: add account switcher')).not.toBeInTheDocument();
    expect(screen.queryByText('GitHub: update dependencies')).not.toBeInTheDocument();
  });

  it('offers Linear reconnection when the selected feed authorization expires', async () => {
    stubSources();
    server.use(
      http.get(`${TEST_BASE_URL}/web/linear/issues`, () =>
        HttpResponse.json(
          {
            error: 'linear_reauth_required',
            message: 'Authorization expired',
          },
          { status: 401 },
        ),
      ),
    );
    const { client } = renderBoard('?source=github&source=linear');
    await waitForMutationsIdle(client);
    await screen.findByRole('button', { name: 'Connect Linear' });
    expect(screen.getByText('Linear authorization expired. Reconnect to keep syncing issues.')).toBeInTheDocument();
  });
  it('explains that filters excluded Intake candidates instead of suggesting an integration setup', async () => {
    stubSources();
    server.use(
      http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
        HttpResponse.json({ workItems: [] }),
      ),
    );
    const view = renderBoard('?source=jira');
    await waitForMutationsIdle(view.client);
    await within(screen.getByTestId('board-column-intake')).findByText('No work items match filters');
    expect(
      within(screen.getByTestId('board-column-intake')).getByText(/Try adjusting or clearing your filters\./),
    ).toBeInTheDocument();
    expect(screen.queryByText('No intake sources')).not.toBeInTheDocument();
  });
});
