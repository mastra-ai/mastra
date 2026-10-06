import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import { createAppRoutes } from '../router';
import { githubIssue, linearIssue, linearIssues, linearProjects, wireSourceCards } from './fixtures/boardSourceFilters';
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

async function selectMany(name: string, options: string[]) {
  if (!screen.queryByRole('combobox', { name: 'Add filter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Filter cards' }));
  const user = userEvent.setup();
  const input = screen.getByRole('combobox', { name: 'Add filter' });
  await user.click(input);
  await user.type(input, name);
  await user.click(await screen.findByRole('option', { name }));
  for (const option of options) await user.click(await screen.findByRole('option', { name: new RegExp(option) }));
  await user.click(screen.getByRole('button', { name: /^Done/ }));
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

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save as view' }));
    await user.click(screen.getByRole('button', { name: 'Save view' }));
    const viewId = new URLSearchParams(first.router.state.location.search).get('view');
    expect(viewId).toBeTruthy();
    first.unmount();
    const second = renderBoard(`?view=${viewId}`);
    await waitForMutationsIdle(second.client);
    await expectPortalView();
    expect(screen.queryByRole('group', { name: 'View filters' })).not.toBeInTheDocument();
  });

  it('restores a project-only URL and combines it with existing label and text filters', async () => {
    stubSources();
    const view = renderBoard('?linearProject=project-a&label=feature&q=Portal');
    await waitForMutationsIdle(view.client);
    await expectPortalView();
    fireEvent.click(screen.getByRole('button', { name: 'Filter cards' }));
    expect(screen.getByText('Customer Portal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Linear project filter' }));
    expect(view.router.state.location.search).not.toContain('linearProject=');
    expect(view.router.state.location.search).toContain('label=feature');
  });

  it('merges selected source feeds and restores the Intake selector after clearing the filter', async () => {
    stubSources();
    const view = renderBoard();
    await screen.findByText('GitHub: update dependencies');
    await waitForMutationsIdle(view.client);
    await selectMany('Intake source', ['GitHub', 'Linear']);
    await screen.findByText('Portal: add account switcher');
    expect(screen.getByText('GitHub: improve error messages')).toBeInTheDocument();
    expect(screen.getByText('GitHub: update dependencies')).toBeInTheDocument();
    expect(screen.queryByText('Manual follow-up')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Intake source filter' }));
    await screen.findByText('Manual follow-up');
    expect(screen.queryByText('Portal: add account switcher')).not.toBeInTheDocument();
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
    renderBoard('?linearProject=project-a');
    fireEvent.click(await screen.findByRole('button', { name: 'Load more candidates' }));
    await screen.findByText('Portal: later page');
    expect(screen.queryByText('Billing: export invoices')).not.toBeInTheDocument();
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
    renderBoard('?source=linear');
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
    await screen.findByText('No work items match filters');
    expect(screen.getByText('Try adjusting or clearing your filters.')).toBeInTheDocument();
    expect(screen.queryByText('No intake sources')).not.toBeInTheDocument();
  });
});
