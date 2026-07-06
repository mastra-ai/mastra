import { useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useKeyDown } from '../../../lib/hooks';
import { CloseIcon, FolderIcon, LogoMark, SearchIcon } from '../../../ui/icons';
import { useGithubReposQuery } from '../hooks/useGithubRepos';
import { useCreateGithubProjectMutation } from '../hooks/useProjects';
import type { GithubRepo, GithubStatus } from '../services/github';
import { connectGithub } from '../services/github';
import type { Project } from '../services/projects';

interface GithubConnectModalProps {
  status: GithubStatus;
  onProjectCreated: (project: Project) => void;
  onClose: () => void;
}

/**
 * Modal for the GitHub App flow. Two steps:
 *  1. Connect — shown when the feature is enabled but the user has no
 *     installation yet; a button kicks off the GitHub App install redirect.
 *  2. Pick a repo — a searchable list of repos across the user's installations;
 *     selecting one creates a `source: 'github'` project and selects it.
 *
 * No clone happens here — the repo is materialized into its sandbox on open.
 */
export function GithubConnectModal({ status, onProjectCreated, onClose }: GithubConnectModalProps) {
  const { baseUrl } = useApiConfig();
  const connected = status.connected;
  const [query, setQuery] = useState('');
  const reposQuery = useGithubReposQuery(query || undefined, connected);
  const createProject = useCreateGithubProjectMutation();
  const repos = reposQuery.data ?? [];
  const loading = reposQuery.isPending;
  const error = reposQuery.error ?? createProject.error;
  const busyRepoId = createProject.isPending ? createProject.variables?.id : null;

  useKeyDown({ escape: () => onClose() });

  const handlePick = async (repo: GithubRepo) => {
    try {
      const stored = await createProject.mutateAsync(repo);
      onProjectCreated(stored);
      onClose();
    } catch {
      // Mutation state renders the error.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-xl flex-col rounded-2xl border border-border1 bg-surface3 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Connect GitHub"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-ui-lg font-semibold text-icon6">
            <LogoMark size={20} className="text-accent1" />
            <span>{connected ? 'Open a GitHub repo' : 'Connect GitHub'}</span>
          </div>
          <button
            className="inline-flex size-8 items-center justify-center rounded-lg text-icon3 hover:bg-surface4 hover:text-icon6"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {!connected ? (
          <>
            <p className="mb-4 mt-0 text-ui-sm leading-relaxed text-icon3">
              Install the MastraCode GitHub App to pick repositories you have access to and turn them into projects.
              Each repo is cloned into its own isolated cloud sandbox when you open it.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-lg bg-accent1 px-4 py-2 text-ui-sm font-medium text-black hover:bg-accent1/90"
              onClick={() => connectGithub(baseUrl)}
            >
              <span>Connect GitHub</span>
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 mt-0 text-ui-sm leading-relaxed text-icon3">
              Choose a repository. It's cloned into an isolated cloud sandbox the first time you open the project.
            </p>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-border1 bg-surface2 px-3 py-2">
              <SearchIcon size={15} className="shrink-0 text-icon2" />
              <input
                className="min-w-0 flex-1 bg-transparent text-ui-sm text-icon6 placeholder:text-icon2 focus:outline-none"
                type="text"
                placeholder="Filter repositories…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {error && <p className="mb-3 mt-0 text-ui-sm text-notice-destructive-fg">{error.message}</p>}

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {loading ? (
                <p className="m-0 text-ui-sm text-icon3">Loading repositories…</p>
              ) : repos.length === 0 ? (
                <p className="m-0 text-ui-sm text-icon3">No repositories found.</p>
              ) : (
                repos.map(repo => (
                  <button
                    key={repo.id}
                    className="flex items-center gap-3 rounded-xl border border-border1 bg-surface2 px-3 py-2 text-left hover:border-border2 hover:bg-surface4 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={busyRepoId !== null}
                    onClick={() => void handlePick(repo)}
                    title={repo.fullName}
                  >
                    <FolderIcon size={18} className="shrink-0 text-icon3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ui-sm font-medium text-icon6">{repo.fullName}</span>
                      <span className="block truncate text-ui-xs text-icon3">
                        {repo.private ? 'private' : 'public'} · {repo.defaultBranch}
                      </span>
                    </span>
                    {busyRepoId === repo.id && <span className="shrink-0 text-ui-xs text-icon3">Adding…</span>}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
