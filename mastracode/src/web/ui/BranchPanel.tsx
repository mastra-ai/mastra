/**
 * Branch / PR panel for a GitHub-backed project.
 *
 * Surfaces the cloud coding-agent write-back flow to the web user: pick or
 * create a feature branch (a git worktree inside the project's sandbox), then
 * commit the agent's changes and open a pull request via the sandbox `gh` CLI.
 *
 * All git work happens server-side inside the sandbox; this component only
 * drives the `/api/web/github/projects/:id/*` endpoints via the `github.ts`
 * helpers. Branch names and PR titles are validated server-side too — the UI
 * just disables actions until the required inputs are present.
 */

import { useState } from 'react';

import { commitChanges, createWorktree, openPullRequest, pushBranch } from './github';
import type { GitOpError, WorktreeResult } from './github';
import { TargetIcon } from './icons';

export interface BranchBinding {
  branch: string;
  worktreePath: string;
  baseBranch: string;
}

export function BranchPanel({
  githubProjectId,
  sandboxEnabled,
  activeBranch,
  activeWorktreePath,
  onWorktreeReady,
  onNotice,
}: {
  githubProjectId: string;
  /** Whether the server has a sandbox provider configured. */
  sandboxEnabled: boolean;
  /** Persisted active branch for this project (rebinds on reopen). */
  activeBranch?: string;
  /** Persisted active worktree path for this project. */
  activeWorktreePath?: string;
  /** Called after a worktree is created so the parent can persist + rebind it. */
  onWorktreeReady: (binding: BranchBinding) => void;
  /** Surface a status / error message to the user (toast). */
  onNotice: (message: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [branchDraft, setBranchDraft] = useState('');
  const [title, setTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [busy, setBusy] = useState<null | 'worktree' | 'commit' | 'push' | 'pr'>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  const hasBranch = !!activeBranch && !!activeWorktreePath;

  function describeError(e: unknown): string {
    const err = e as GitOpError;
    if (err?.authRequired) return 'Your session expired — please sign in again.';
    return err instanceof Error ? err.message : String(e);
  }

  async function handleCreateBranch(e: { preventDefault: () => void }) {
    e.preventDefault();
    const branch = branchDraft.trim();
    if (!branch) return;
    setBusy('worktree');
    try {
      const result: WorktreeResult = await createWorktree(githubProjectId, branch);
      onWorktreeReady({
        branch: result.branch,
        worktreePath: result.worktreePath,
        baseBranch: result.baseBranch,
      });
      setBranchDraft('');
      setPrUrl(null);
      onNotice(`Branch ${result.branch} ready`, 'success');
    } catch (err) {
      onNotice(describeError(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    if (!activeBranch || !activeWorktreePath) return;
    const message = title.trim() || `Update from Mastra Code on ${activeBranch}`;
    setBusy('commit');
    try {
      const result = await commitChanges(githubProjectId, message, activeWorktreePath);
      onNotice(result.committed ? 'Changes committed' : 'Nothing to commit', result.committed ? 'success' : 'info');
    } catch (err) {
      onNotice(describeError(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handlePush() {
    if (!activeBranch || !activeWorktreePath) return;
    setBusy('push');
    try {
      await pushBranch(githubProjectId, activeBranch, activeWorktreePath);
      onNotice(`Pushed ${activeBranch}`, 'success');
    } catch (err) {
      onNotice(describeError(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleOpenPr() {
    if (!activeBranch || !activeWorktreePath) return;
    const prTitle = title.trim();
    if (!prTitle) {
      onNotice('A pull request title is required', 'error');
      return;
    }
    setBusy('pr');
    try {
      const result = await openPullRequest(githubProjectId, {
        branch: activeBranch,
        title: prTitle,
        body: prBody.trim() || undefined,
        worktreePath: activeWorktreePath,
      });
      setPrUrl(result.url);
      onNotice('Pull request opened', 'success');
    } catch (err) {
      onNotice(describeError(err), 'error');
    } finally {
      setBusy(null);
    }
  }

  if (!sandboxEnabled) {
    return (
      <div className="branch-panel branch-panel-disabled" role="note">
        <span className="branch-panel-icon">
          <TargetIcon size={14} />
        </span>
        <span className="branch-panel-hint">
          Branch &amp; PR actions need a sandbox provider configured on the server.
        </span>
      </div>
    );
  }

  return (
    <div className="branch-panel">
      <div className="branch-panel-row">
        <span className="branch-panel-icon">
          <TargetIcon size={14} />
        </span>
        {hasBranch ? (
          <span className="branch-panel-current" title={activeWorktreePath}>
            On branch <strong>{activeBranch}</strong>
          </span>
        ) : (
          <span className="branch-panel-current branch-panel-muted">No feature branch yet</span>
        )}
      </div>

      <form className="branch-panel-row" onSubmit={handleCreateBranch}>
        <input
          className="input branch-panel-input"
          value={branchDraft}
          onChange={e => setBranchDraft(e.target.value)}
          placeholder={hasBranch ? 'Switch to / create another branch…' : 'feature-branch-name'}
          aria-label="Branch name"
          disabled={busy !== null}
        />
        <button className="btn btn-sm" type="submit" disabled={busy !== null || !branchDraft.trim()}>
          {busy === 'worktree' ? 'Creating…' : 'Create branch'}
        </button>
      </form>

      {hasBranch && (
        <div className="branch-panel-pr">
          <input
            className="input branch-panel-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Commit message / PR title"
            aria-label="Commit message or PR title"
            disabled={busy !== null}
          />
          <textarea
            className="input branch-panel-textarea"
            value={prBody}
            onChange={e => setPrBody(e.target.value)}
            placeholder="PR description (optional)"
            aria-label="PR description"
            rows={2}
            disabled={busy !== null}
          />
          <div className="branch-panel-actions">
            <button className="btn btn-sm" onClick={handleCommit} disabled={busy !== null}>
              {busy === 'commit' ? 'Committing…' : 'Commit'}
            </button>
            <button className="btn btn-sm" onClick={handlePush} disabled={busy !== null}>
              {busy === 'push' ? 'Pushing…' : 'Push'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleOpenPr} disabled={busy !== null || !title.trim()}>
              {busy === 'pr' ? 'Opening…' : 'Open PR'}
            </button>
          </div>
          {prUrl && (
            <a className="branch-panel-prlink" href={prUrl} target="_blank" rel="noreferrer noopener">
              View pull request →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
