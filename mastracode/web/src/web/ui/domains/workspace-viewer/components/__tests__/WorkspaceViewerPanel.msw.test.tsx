import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../../e2e/web-ui/render';
import { WorkspaceViewerPanel } from '../WorkspaceViewerPanel';

const LIST_URL = `${TEST_BASE_URL}/web/workspace/rendered/list`;
const FILE_URL = `${TEST_BASE_URL}/web/workspace/file`;
const WORKSPACE = '/home/user/project';

const renderedPaths = [{ id: 'artifacts', label: 'Artifacts', root: '.artifacts' }];

function installHandlers() {
  server.use(
    http.get(LIST_URL, ({ request }) => {
      const root = new URL(request.url).searchParams.get('root');
      if (root === '.reports') {
        return HttpResponse.json({
          workspacePath: WORKSPACE,
          root: '.reports',
          rootPath: `${WORKSPACE}/.reports`,
          entries: [{ name: 'summary.md', path: 'summary.md', type: 'file', size: 7, updatedAt: '2026-07-16T00:00:00.000Z' }],
        });
      }
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        root: '.artifacts',
        rootPath: `${WORKSPACE}/.artifacts`,
        entries: [
          { name: 'understand-pr', path: 'understand-pr', type: 'directory', size: 0, updatedAt: '2026-07-16T00:00:00.000Z' },
          { name: 'HISTORY.md', path: 'understand-pr/HISTORY.md', type: 'file', size: 7, updatedAt: '2026-07-16T00:00:00.000Z' },
        ],
      });
    }),
    http.get(FILE_URL, ({ request }) => {
      const path = new URL(request.url).searchParams.get('path');
      return HttpResponse.json({
        workspacePath: WORKSPACE,
        path,
        name: path?.split('/').pop() ?? 'file.md',
        size: 7,
        updatedAt: '2026-07-16T00:00:00.000Z',
        contentType: 'text',
        content: '# Notes',
      });
    }),
  );
}

describe('WorkspaceViewerPanel', () => {
  it('shows an empty state for configured paths with no files', async () => {
    server.use(
      http.get(LIST_URL, () =>
        HttpResponse.json({ workspacePath: WORKSPACE, root: '.artifacts', rootPath: `${WORKSPACE}/.artifacts`, entries: [] }),
      ),
    );

    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    expect(await screen.findByText('Files')).toBeInTheDocument();
    expect(await screen.findByText('No files in this workspace path.')).toBeInTheDocument();
  });

  it('expands folders inline and opens the selected file viewer left of the browser', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    const root = await screen.findByRole('button', { name: '.artifacts' });
    expect(root).toHaveAttribute('aria-expanded', 'true');

    const folder = await screen.findByRole('button', { name: 'understand-pr' });
    expect(folder).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('HISTORY.md')).not.toBeInTheDocument();

    await user.click(folder);

    expect(folder).toHaveAttribute('aria-expanded', 'true');
    await user.click(folder);
    expect(folder).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('HISTORY.md')).not.toBeInTheDocument();

    await user.click(folder);
    expect(folder).toHaveAttribute('aria-expanded', 'true');
    await user.click(await screen.findByText('HISTORY.md'));

    expect(await screen.findByLabelText('Workspace file viewer')).toBeInTheDocument();
    expect(await screen.findByText('Notes')).toBeInTheDocument();
  });

  it('can switch between configured rendered roots', async () => {
    installHandlers();
    const user = userEvent.setup();
    renderWithProviders(
      <WorkspaceViewerPanel
        workspacePath={WORKSPACE}
        renderedPaths={[
          ...renderedPaths,
          { id: 'reports', label: 'Reports', root: '.reports' },
        ]}
      />,
    );

    await user.click(await screen.findByRole('button', { name: '.reports' }));

    expect(await screen.findByText('summary.md')).toBeInTheDocument();
  });

  it('refreshes the current listing', async () => {
    let calls = 0;
    server.use(
      http.get(LIST_URL, () => {
        calls += 1;
        return HttpResponse.json({ workspacePath: WORKSPACE, root: '.artifacts', rootPath: `${WORKSPACE}/.artifacts`, entries: [] });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<WorkspaceViewerPanel workspacePath={WORKSPACE} renderedPaths={renderedPaths} />);

    await screen.findByText('No files in this workspace path.');
    await user.click(screen.getByRole('button', { name: 'Refresh workspace files' }));

    expect(calls).toBeGreaterThan(1);
  });
});
