import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { WorkspaceChange, WorkspaceChanges } from '../../../../../api/types';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import type { WorkspacePanelPage } from '../../context/WorkspacePanelContext';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';
import userEvent from '@testing-library/user-event';

const WORKSPACE = '/workspace/overview-changes';
const SESSION_ID = 'session-overview-1';
const SESSION_URL = `${TEST_BASE_URL}/web/user-sessions/${SESSION_ID}`;

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

function serveChanges(changes: WorkspaceChange[]) {
  const body: WorkspaceChanges = {
    workspacePath: WORKSPACE,
    available: true,
    changes,
    additions: changes.reduce((sum, change) => sum + (change.additions ?? 0), 0),
    deletions: changes.reduce((sum, change) => sum + (change.deletions ?? 0), 0),
  };
  server.use(http.get(`${TEST_BASE_URL}/web/workspace/changes`, () => HttpResponse.json(body)));
}

const modified = (path: string, additions: number, deletions: number): WorkspaceChange => ({
  path,
  status: 'modified',
  additions,
  deletions,
});

describe('workspace overview of the branch’s changes', () => {
  it('names each file of a small change, conflicts first', async () => {
    serveChanges([
      modified('packages/core/src/retry.test.ts', 96, 0),
      { path: 'packages/core/src/retry.ts', status: 'conflicted' },
      modified('CHANGELOG.md', 3, 1),
    ]);

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    const changes = await screen.findByRole('button', { name: 'Changes, 3 files, 1 conflict' });
    const files = within(changes)
      .getAllByTitle(/\.(ts|md)$/)
      .map(row => row.getAttribute('title'));
    expect(files).toEqual(['packages/core/src/retry.ts', 'packages/core/src/retry.test.ts', 'CHANGELOG.md']);
    expect(changes).toHaveTextContent('+99');
    expect(changes).toHaveTextContent('1 conflict');
  });

  it('draws a large change as tiles and counts the files it has no room for', async () => {
    serveChanges(Array.from({ length: 150 }, (_, index) => modified(`src/file-${index}.ts`, index, 1)));

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    const changes = await screen.findByRole('button', { name: 'Changes, 150 files' });
    expect(changes).toHaveTextContent('150 files');
    expect(changes).toHaveTextContent('+104 more');
    expect(within(changes).queryByText('file-0.ts')).not.toBeInTheDocument();
  });

  it('names the file under a tile the viewer points at', async () => {
    serveChanges(Array.from({ length: 150 }, (_, index) => modified(`src/file-${index}.ts`, index, 1)));
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    const changes = await screen.findByRole('button', { name: 'Changes, 150 files' });
    const tile = changes.querySelector('[data-path="src/file-7.ts"]');
    if (!(tile instanceof HTMLElement)) throw new Error('No tile for src/file-7.ts');
    await user.hover(tile);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('file-7.ts');
    expect(tooltip).toHaveTextContent('src');
    expect(tooltip).toHaveTextContent('+7');
  });

  it('says so when the branch changed nothing', async () => {
    serveChanges([]);

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    expect(await screen.findByRole('button', { name: 'Changes, 0 files' })).toHaveTextContent('No changes');
  });

  it('calls a checkout git could not read unavailable, without blaming the sandbox', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/web/workspace/changes`, () =>
        HttpResponse.json({ workspacePath: WORKSPACE, available: false, changes: [] }),
      ),
    );

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    expect(await screen.findByRole('button', { name: 'Changes, unavailable' })).toHaveTextContent(
      'Changes unavailable',
    );
    expect(screen.queryByText(/sandbox/i)).not.toBeInTheDocument();
  });
});

describe('workspace overview of the card’s own pull request', () => {
  const page: WorkspacePanelPage = {
    subject: lead => lead,
    overview: workspace =>
      workspace?.({
        changeRequest: {
          badge: <a href="https://github.com/mastra-ai/mastra/pull/30895">#30895</a>,
          status: 'open',
        },
      }),
  };

  it.each([
    ['while the branch details load', () => delay('infinite')],
    ['when the branch details fail to load', () => HttpResponse.json({ error: 'boom' }, { status: 500 })],
  ])('keeps the pull request reachable %s', async (_, answer) => {
    serveChanges([]);
    server.use(http.get(SESSION_URL, answer));

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} sessionId={SESSION_ID} page={page} />);

    expect(await screen.findByRole('link', { name: '#30895' })).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/pull/30895',
    );
  });
});
