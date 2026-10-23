import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { WorkspaceChanges } from '../../../../../api/types';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL, renderWithProviders } from '../../../../../../e2e/ui/render';
import { WorkspaceChangesPanel } from '../WorkspaceChangesPanel';
import { WORKSPACE, multiRepositoryChanges, singleRepositoryChanges } from './fixtures/workspace-repositories';

const PATCHES_URL = `${TEST_BASE_URL}/web/workspace/changes/patches`;

Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', { value: () => {} });

function repositoryGroups(container: HTMLElement) {
  return within(container).queryAllByTestId('workspace-repository-group');
}

function treeItemIds(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-tree-item-id]')).map(
    item => item.dataset.treeItemId,
  );
}

/** Opens the Changes panel on `changes` and returns its jump-to-file tree. */
async function openFileTree(changes: WorkspaceChanges) {
  server.use(http.get(PATCHES_URL, () => HttpResponse.json({ ...changes, scope: 'branch', patches: {} })));
  const user = userEvent.setup();
  renderWithProviders(
    <WorkspaceChangesPanel
      workspacePath={WORKSPACE}
      visible
      repositoryProviders={{ 'mastra-ai/mastra': 'github', 'mastra-ai/platform': 'gitlab' }}
      onBack={() => {}}
    />,
  );
  await user.click(await screen.findByRole('button', { name: /^Jump to file/ }));
  const tree = await screen.findByRole('dialog');
  return { user, tree };
}

describe('workspace repository groups', () => {
  it('lists one group per repository in payload order, keeping each file under its prefixed path', async () => {
    const { tree } = await openFileTree(multiRepositoryChanges);

    const groups = repositoryGroups(tree);
    expect(groups.map(group => group.textContent)).toEqual([
      expect.stringContaining('mastra-ai/mastra'),
      expect.stringContaining('mastra-ai/platform'),
      expect.stringContaining('mastra-ai/mastra-website'),
    ]);
    expect(within(groups[0]).getByTestId('repository-provider-github')).toBeInTheDocument();
    expect(within(groups[1]).getByTestId('repository-provider-gitlab')).toBeInTheDocument();
    expect(within(groups[2]).getByTestId('repository-provider-github')).toBeInTheDocument();
    expect(groups[0]).toHaveTextContent('2 files');
    expect(groups[0]).toHaveTextContent('+6');
    expect(groups[0]).toHaveTextContent('−2');
    expect(groups[1]).toHaveTextContent('1 file');
    expect(groups[1]).toHaveTextContent('+3');
    expect(groups[2]).toHaveTextContent('0 files');
    expect(treeItemIds(tree)).toEqual(['mastra/src/agent.ts', 'mastra/README.md', 'platform/proof.txt']);
    expect(within(tree).queryByText('mastra')).not.toBeInTheDocument();
    expect(within(tree).getByText('src')).toBeInTheDocument();
  });

  it('collapses a repository group without touching the others', async () => {
    const { user, tree } = await openFileTree(multiRepositoryChanges);

    await user.click(within(tree).getByRole('button', { name: 'Hide files in mastra-ai/mastra' }));

    expect(treeItemIds(tree)).toEqual(['platform/proof.txt']);
    expect(within(tree).getByRole('button', { name: 'Show files in mastra-ai/mastra' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('renders a one-repository session without any group header', async () => {
    const { tree } = await openFileTree(singleRepositoryChanges);

    expect(repositoryGroups(tree)).toHaveLength(0);
    expect(treeItemIds(tree)).toEqual(['src/agent.ts', 'README.md']);
    expect(within(tree).getByRole('button', { name: 'src' })).toHaveAttribute('aria-expanded', 'true');
  });
});
