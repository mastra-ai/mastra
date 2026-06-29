import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/web-ui/msw-server';
import { renderWithProviders } from '../../../e2e/web-ui/render';
import { BranchPanel } from './BranchPanel';

const ORIGIN = 'http://localhost:3000';
const PROJECT = 'proj-1';

function gitOpUrl(action: string): string {
  return `${ORIGIN}/api/web/github/projects/${PROJECT}/${action}`;
}

describe('BranchPanel', () => {
  it('shows a disabled hint when no sandbox provider is configured', () => {
    renderWithProviders(
      <BranchPanel githubProjectId={PROJECT} sandboxEnabled={false} onWorktreeReady={vi.fn()} onNotice={vi.fn()} />,
    );
    expect(screen.getByText(/need a sandbox provider/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Branch name')).not.toBeInTheDocument();
  });

  it('creates a worktree and reports the binding back to the parent', async () => {
    const onWorktreeReady = vi.fn();
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
    );

    renderWithProviders(
      <BranchPanel githubProjectId={PROJECT} sandboxEnabled onWorktreeReady={onWorktreeReady} onNotice={onNotice} />,
    );

    fireEvent.change(screen.getByLabelText('Branch name'), { target: { value: 'feat-x' } });
    fireEvent.click(screen.getByRole('button', { name: /create branch/i }));

    await waitFor(() =>
      expect(onWorktreeReady).toHaveBeenCalledWith({
        branch: 'feat-x',
        worktreePath: '/workspace/worktrees/feat-x',
        baseBranch: 'main',
      }),
    );
    expect(onNotice).toHaveBeenCalledWith('Branch feat-x ready', 'success');
  });

  it('opens a PR and renders the resulting link when a branch is active', async () => {
    const onNotice = vi.fn();
    server.use(http.post(gitOpUrl('pr'), () => HttpResponse.json({ url: 'https://github.com/o/r/pull/9' })));

    renderWithProviders(
      <BranchPanel
        githubProjectId={PROJECT}
        sandboxEnabled
        activeBranch="feat-x"
        activeWorktreePath="/workspace/worktrees/feat-x"
        onWorktreeReady={vi.fn()}
        onNotice={onNotice}
      />,
    );

    fireEvent.change(screen.getByLabelText('Commit message or PR title'), { target: { value: 'My PR' } });
    fireEvent.click(screen.getByRole('button', { name: /open pr/i }));

    await waitFor(() => expect(screen.getByText(/view pull request/i)).toBeInTheDocument());
    expect(screen.getByText(/view pull request/i)).toHaveAttribute('href', 'https://github.com/o/r/pull/9');
    expect(onNotice).toHaveBeenCalledWith('Pull request opened', 'success');
  });

  it('blocks opening a PR without a title', async () => {
    const onNotice = vi.fn();
    renderWithProviders(
      <BranchPanel
        githubProjectId={PROJECT}
        sandboxEnabled
        activeBranch="feat-x"
        activeWorktreePath="/workspace/worktrees/feat-x"
        onWorktreeReady={vi.fn()}
        onNotice={onNotice}
      />,
    );

    // Open PR button is disabled until a title is entered.
    expect(screen.getByRole('button', { name: /open pr/i })).toBeDisabled();
  });

  it('surfaces a server error via onNotice', async () => {
    const onNotice = vi.fn();
    server.use(
      http.post(gitOpUrl('worktree'), () =>
        HttpResponse.json({ error: 'Invalid branch', message: 'branch name is invalid' }, { status: 400 }),
      ),
    );

    renderWithProviders(
      <BranchPanel githubProjectId={PROJECT} sandboxEnabled onWorktreeReady={vi.fn()} onNotice={onNotice} />,
    );

    fireEvent.change(screen.getByLabelText('Branch name'), { target: { value: 'bad-ref' } });
    fireEvent.click(screen.getByRole('button', { name: /create branch/i }));

    await waitFor(() => expect(onNotice).toHaveBeenCalledWith('branch name is invalid', 'error'));
  });
});
