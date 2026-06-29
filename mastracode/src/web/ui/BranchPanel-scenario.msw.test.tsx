import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/web-ui/msw-server';
import { renderWithProviders } from '../../../e2e/web-ui/render';
import { BranchPanel } from './BranchPanel';
import type { BranchBinding } from './BranchPanel';

const ORIGIN = 'http://localhost:3000';
const PROJECT = 'proj-1';

function gitOpUrl(action: string): string {
  return `${ORIGIN}/api/web/github/projects/${PROJECT}/${action}`;
}

/**
 * Mirrors how `App.tsx` hosts the panel: it persists the worktree binding from
 * `onWorktreeReady` into local state and feeds it back as `activeBranch` /
 * `activeWorktreePath`, which is what unlocks the commit/push/PR controls. This
 * lets the scenario walk the whole create → commit → push → PR journey through
 * a single mounted tree, the way a real user would.
 */
function HostedBranchPanel({ onNotice }: { onNotice: (m: string, k?: 'success' | 'error' | 'info') => void }) {
  const [binding, setBinding] = useState<BranchBinding | null>(null);
  return (
    <BranchPanel
      githubProjectId={PROJECT}
      sandboxEnabled
      activeBranch={binding?.branch}
      activeWorktreePath={binding?.worktreePath}
      onWorktreeReady={setBinding}
      onNotice={onNotice}
    />
  );
}

describe('S6 — BranchPanel end-to-end write-back journey', () => {
  it('walks create branch → commit → push → open PR in one mounted panel', async () => {
    const onNotice = vi.fn();
    server.use(
      http.post(gitOpUrl('worktree'), () =>
        HttpResponse.json({
          worktreePath: '/workspace/worktrees/feat-x',
          branch: 'feat-x',
          baseBranch: 'main',
          resourceId: 'res-1',
        }),
      ),
      http.post(gitOpUrl('commit'), () => HttpResponse.json({ committed: true })),
      http.post(gitOpUrl('push'), () => HttpResponse.json({ pushed: true, branch: 'feat-x' })),
      http.post(gitOpUrl('pr'), () => HttpResponse.json({ url: 'https://github.com/o/r/pull/42' })),
    );

    renderWithProviders(<HostedBranchPanel onNotice={onNotice} />);

    // Step 1: no branch yet — commit/push/PR controls are hidden.
    expect(screen.getByText(/no feature branch yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^commit$/i })).not.toBeInTheDocument();

    // Step 2: create the feature branch (worktree).
    fireEvent.change(screen.getByLabelText('Branch name'), { target: { value: 'feat-x' } });
    fireEvent.click(screen.getByRole('button', { name: /create branch/i }));

    // The binding is persisted and the panel rebinds to show the active branch.
    await waitFor(() => expect(screen.getByText(/on branch/i)).toBeInTheDocument());
    expect(onNotice).toHaveBeenCalledWith('Branch feat-x ready', 'success');

    // Step 3: enter a title, then commit.
    fireEvent.change(screen.getByLabelText('Commit message or PR title'), { target: { value: 'Ship feature' } });
    fireEvent.click(screen.getByRole('button', { name: /^commit$/i }));
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Changes committed', 'success'));

    // Step 4: push.
    fireEvent.click(screen.getByRole('button', { name: /^push$/i }));
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Pushed feat-x', 'success'));

    // Step 5: open the PR — the link surfaces in the panel.
    fireEvent.click(screen.getByRole('button', { name: /open pr/i }));
    await waitFor(() => expect(screen.getByText(/view pull request/i)).toBeInTheDocument());
    expect(screen.getByText(/view pull request/i)).toHaveAttribute('href', 'https://github.com/o/r/pull/42');
    expect(onNotice).toHaveBeenCalledWith('Pull request opened', 'success');
  });

  it('surfaces an expired-session prompt when a git op returns 401 mid-flow', async () => {
    const onNotice = vi.fn();
    // Branch creation succeeds, but the later commit hits an expired session.
    server.use(
      http.post(gitOpUrl('worktree'), () =>
        HttpResponse.json({
          worktreePath: '/workspace/worktrees/feat-x',
          branch: 'feat-x',
          baseBranch: 'main',
          resourceId: 'res-1',
        }),
      ),
      http.post(gitOpUrl('commit'), () => HttpResponse.json({ error: 'unauthorized' }, { status: 401 })),
    );

    renderWithProviders(<HostedBranchPanel onNotice={onNotice} />);

    fireEvent.change(screen.getByLabelText('Branch name'), { target: { value: 'feat-x' } });
    fireEvent.click(screen.getByRole('button', { name: /create branch/i }));
    await waitFor(() => expect(screen.getByText(/on branch/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^commit$/i }));
    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('Your session expired — please sign in again.', 'error'));
  });

  it('keeps the whole journey hidden when no sandbox provider is configured', () => {
    renderWithProviders(
      <BranchPanel githubProjectId={PROJECT} sandboxEnabled={false} onWorktreeReady={vi.fn()} onNotice={vi.fn()} />,
    );
    expect(screen.getByText(/need a sandbox provider/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Branch name')).not.toBeInTheDocument();
  });
});
