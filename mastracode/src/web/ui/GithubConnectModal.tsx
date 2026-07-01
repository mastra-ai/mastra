import { useEffect, useState } from 'react';

import type { GithubRepo, GithubStatus } from './github';
import { connectGithub, createProjectFromRepo, listGithubRepos } from './github';
import { CloseIcon, FolderIcon, LogoMark, SearchIcon } from './icons';
import type { Project } from './projects';
import { addGithubProject } from './projects';

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
  const connected = status.connected;
  const [query, setQuery] = useState('');
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [loading, setLoading] = useState(connected);
  const [busyRepoId, setBusyRepoId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load repos once connected. Searching re-queries the server.
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    listGithubRepos(query || undefined)
      .then(list => {
        if (!cancelled) setRepos(list);
      })
      .catch(e => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connected, query]);

  const handlePick = async (repo: GithubRepo) => {
    setBusyRepoId(repo.id);
    setError(null);
    try {
      const created = await createProjectFromRepo(repo);
      const stored = addGithubProject(created);
      onProjectCreated(stored);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyRepoId(null);
    }
  };

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div
        className="projects-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Connect GitHub"
        onClick={e => e.stopPropagation()}
      >
        <div className="projects-head">
          <div className="projects-head-title">
            <LogoMark size={20} className="logo-mark" />
            <span>{connected ? 'Open a GitHub repo' : 'Connect GitHub'}</span>
          </div>
          <button className="settings-close" onClick={onClose} aria-label="Close">
            <CloseIcon size={16} />
          </button>
        </div>

        {!connected ? (
          <>
            <p className="projects-sub">
              Install the MastraCode GitHub App to pick repositories you have access to and turn them into projects.
              Each repo is cloned into its own isolated cloud sandbox when you open it.
            </p>
            <button className="projects-add-btn" onClick={connectGithub}>
              <span>Connect GitHub</span>
            </button>
          </>
        ) : (
          <>
            <p className="projects-sub">
              Choose a repository. It's cloned into an isolated cloud sandbox the first time you open the project.
            </p>
            <div className="github-search">
              <SearchIcon size={15} className="github-search-icon" />
              <input
                className="github-search-input"
                type="text"
                placeholder="Filter repositories…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
            </div>

            {error && <p className="github-error">{error}</p>}

            <div className="projects-list">
              {loading ? (
                <p className="github-muted">Loading repositories…</p>
              ) : repos.length === 0 ? (
                <p className="github-muted">No repositories found.</p>
              ) : (
                repos.map(repo => (
                  <button
                    key={repo.id}
                    className="project-card"
                    disabled={busyRepoId !== null}
                    onClick={() => void handlePick(repo)}
                    title={repo.fullName}
                  >
                    <FolderIcon size={18} className="project-card-icon" />
                    <span className="project-card-text">
                      <span className="project-card-name">{repo.fullName}</span>
                      <span className="project-card-path">
                        {repo.private ? 'private' : 'public'} · {repo.defaultBranch}
                      </span>
                    </span>
                    {busyRepoId === repo.id && <span className="project-card-badge">Adding…</span>}
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
