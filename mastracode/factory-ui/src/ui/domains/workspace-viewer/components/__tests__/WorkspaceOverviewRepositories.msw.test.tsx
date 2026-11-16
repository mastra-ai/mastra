import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { WorkspaceChanges } from '../../../../../api/types';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';
import { WORKSPACE, multiRepositoryChanges } from './fixtures/workspace-repositories';

const TREE_URL = `${TEST_BASE_URL}/web/workspace/tree`;
const CHANGES_URL = `${TEST_BASE_URL}/web/workspace/changes`;
const PATCHES_URL = `${TEST_BASE_URL}/web/workspace/changes/patches`;

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

const cleanMastra = {
  slug: 'mastra-ai/mastra',
  prefix: 'mastra/',
  available: true,
  additions: 0,
  deletions: 0,
  changes: [],
};
const unreadablePlatform = { slug: 'mastra-ai/platform', prefix: 'platform/', available: false, changes: [] };

function installHandlers(changes: WorkspaceChanges) {
  server.use(
    http.get(TREE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path') ?? '';
      const entries =
        path === ''
          ? [
              { name: 'mastra', path: 'mastra', type: 'directory' },
              { name: 'platform', path: 'platform', type: 'directory' },
            ]
          : [];
      return HttpResponse.json({ workspacePath: WORKSPACE, path, available: true, entries });
    }),
    http.get(CHANGES_URL, () => HttpResponse.json(changes)),
    http.get(PATCHES_URL, () => HttpResponse.json({ ...changes, scope: 'branch', patches: {}, omittedPatches: {} })),
  );
}

describe('workspace overview of a multi-repository session', () => {
  it('counts the changed files with the repositories that hold them', async () => {
    installHandlers(multiRepositoryChanges);

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);

    expect(await screen.findByRole('button', { name: 'Changes, 3 files in 2 of 3 repos' })).toBeInTheDocument();
  });

  it('says a repository could not be read, and opens Changes to name it, though the others have no changes', async () => {
    installHandlers({
      workspacePath: WORKSPACE,
      available: true,
      additions: 0,
      deletions: 0,
      changes: [],
      repositories: [cleanMastra, unreadablePlatform],
    });
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
    await user.click(await screen.findByRole('button', { name: 'Changes, 0 files, 1 repo unreadable' }));

    expect(screen.getByRole('tab', { name: 'Changes' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText("Couldn't read changes in mastra-ai/platform")).toBeInTheDocument();
  });

  it('calls the changes unavailable when no repository could be read, without offering to wake a running sandbox', async () => {
    installHandlers({
      workspacePath: WORKSPACE,
      available: false,
      changes: [],
      repositories: [{ ...cleanMastra, available: false }, unreadablePlatform],
    });
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
    await user.click(await screen.findByRole('button', { name: 'Changes, unavailable' }));

    expect(
      await screen.findByText("Couldn't read changes in mastra-ai/mastra, mastra-ai/platform"),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Wake sandbox' })).not.toBeInTheDocument();
    expect(screen.queryByText('No changes')).not.toBeInTheDocument();
  });

  it('says the files of a repository it could not read carry no change marks', async () => {
    installHandlers({
      workspacePath: WORKSPACE,
      available: true,
      additions: 0,
      deletions: 0,
      changes: [],
      repositories: [cleanMastra, unreadablePlatform],
    });
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
    await user.click(await screen.findByRole('button', { name: /^Changes, / }));
    await user.click(screen.getByRole('tab', { name: 'Files' }));

    expect(await screen.findByText('Change marks unavailable for mastra-ai/platform')).toBeInTheDocument();
  });
});

describe('workspace files when changes cannot be read', () => {
  it('says change marks are unavailable instead of showing every file unchanged', async () => {
    installHandlers(multiRepositoryChanges);
    server.use(http.get(CHANGES_URL, () => HttpResponse.json({ error: 'git failed' }, { status: 500 })));
    const user = userEvent.setup();

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} />);
    await user.click(await screen.findByRole('button', { name: 'Changes, unavailable' }));
    await user.click(screen.getByRole('tab', { name: 'Files' }));

    expect(await screen.findByText('Change marks unavailable')).toBeInTheDocument();
  });
});
