import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { WorkspaceChangesPanel } from '../WorkspaceChangesPanel';
import { WORKSPACE, multiRepositoryChanges, singleRepositoryChanges } from './fixtures/workspace-repositories';

const DIFF_URL = `${TEST_BASE_URL}/web/workspace/changes/diff`;

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

function repositoryGroups(container: HTMLElement) {
  return within(container).queryAllByTestId('workspace-repository-group');
}

function treeItemIds(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-tree-item-id]')).map(
    item => item.dataset.treeItemId,
  );
}

function renderChanges(changes: typeof multiRepositoryChanges) {
  const noop = () => {};
  return renderWithProviders(
    <WorkspaceChangesPanel
      workspacePath={WORKSPACE}
      visible
      changes={changes}
      repositoryProviders={{ 'mastra-ai/mastra': 'github', 'mastra-ai/platform': 'gitlab' }}
      isLoading={false}
      isRefreshing={false}
      onRefresh={noop}
      onBack={noop}
    />,
  );
}

describe('workspace repository groups', () => {
  it('renders one changes group per repository in payload order and requests diffs with the prefixed path', async () => {
    const diffRequests: Array<string | null> = [];
    server.use(
      http.get(DIFF_URL, ({ request }) => {
        const url = new URL(request.url);
        diffRequests.push(url.search);
        return HttpResponse.json({
          workspacePath: WORKSPACE,
          path: url.searchParams.get('path'),
          patch: 'diff --git a/proof.txt b/proof.txt\n--- /dev/null\n+++ b/proof.txt\n@@ -0,0 +1 @@\n+proof\n',
          truncated: false,
        });
      }),
    );
    const user = userEvent.setup();

    renderChanges(multiRepositoryChanges);

    const panel = screen.getByTestId('workspace-changes-panel');
    const groups = repositoryGroups(panel);
    expect(groups.map(group => group.textContent)).toEqual([
      expect.stringContaining('mastra-ai/mastra'),
      expect.stringContaining('mastra-ai/platform'),
      expect.stringContaining('mastra-ai/mastra-website'),
    ]);
    // The icon follows the factory's provider for the slug; an unknown slug gets the GitHub icon.
    expect(within(groups[0]).getByTestId('repository-provider-github')).toBeInTheDocument();
    expect(within(groups[1]).getByTestId('repository-provider-gitlab')).toBeInTheDocument();
    expect(within(groups[2]).getByTestId('repository-provider-github')).toBeInTheDocument();
    expect(groups[0]).toHaveTextContent('2 files');
    expect(groups[0]).toHaveTextContent('+6');
    expect(groups[0]).toHaveTextContent('−2');
    expect(groups[1]).toHaveTextContent('1 file');
    expect(groups[1]).toHaveTextContent('+3');
    expect(groups[2]).toHaveTextContent('0 files');
    // The repository directory is stripped from the rows; the request path keeps it.
    expect(treeItemIds(panel)).toEqual(['mastra/src/agent.ts', 'mastra/README.md', 'platform/proof.txt']);
    expect(within(panel).queryByText('mastra')).not.toBeInTheDocument();
    expect(within(panel).getByText('src')).toBeInTheDocument();

    await user.click(within(panel).getByText('proof.txt'));

    await within(await screen.findByTestId('workspace-changes-panel')).findByLabelText('Workspace change diff');
    expect(diffRequests).toEqual([`?workspacePath=${WORKSPACE}&path=platform%2Fproof.txt`]);
  });

  it('collapses a repository group without touching the others', async () => {
    const user = userEvent.setup();
    renderChanges(multiRepositoryChanges);

    const panel = screen.getByTestId('workspace-changes-panel');
    await user.click(within(panel).getByRole('button', { name: 'Hide files in mastra-ai/mastra' }));

    expect(treeItemIds(panel)).toEqual(['platform/proof.txt']);
    expect(within(panel).getByRole('button', { name: 'Show files in mastra-ai/mastra' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('renders a one-repository session without any group header, as before', () => {
    renderChanges(singleRepositoryChanges);
    const changesPanel = screen.getByTestId('workspace-changes-panel');
    expect(repositoryGroups(changesPanel)).toHaveLength(0);
    expect(treeItemIds(changesPanel)).toEqual(['src/agent.ts', 'README.md']);
    expect(within(changesPanel).getByRole('button', { name: 'src' })).toHaveAttribute('aria-expanded', 'true');
    expect(within(changesPanel).getByText('agent.ts')).toBeInTheDocument();
    expect(within(changesPanel).getByText('README.md')).toBeInTheDocument();
  });
});
