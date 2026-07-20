import { useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useKeyDown } from '../../../lib/hooks';
import { CloseIcon, FolderIcon, LogoMark, SearchIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useGithubReposQuery } from '../../../../../shared/hooks/useGithubRepos';
import { useCreateGithubFactoryMutation } from '../../../../../shared/hooks/useFactories';
import type { GithubRepo, GithubStatus } from '../services/github';
import { connectGithub, manageGithubConnection } from '../services/github';
import type { Factory } from '../services/factories';

interface GithubConnectModalProps {
  status: GithubStatus;
  onFactoryCreated: (factory: Factory) => void;
  onClose: () => void;
}

/**
 * Modal for the GitHub App flow. Two steps:
 *  1. Connect — shown when the feature is enabled but the user has no
 *     installation yet; a button kicks off the GitHub App install redirect.
 *  2. Pick a repo — a searchable list of repos across the user's installations;
 *     selecting one creates a GitHub-backed factory and selects it.
 *
 * No clone happens here — the repo is materialized into its sandbox on open.
 */
export function GithubConnectModal({ status, onFactoryCreated, onClose }: GithubConnectModalProps) {
  const { baseUrl } = useApiConfig();
  const connected = status.connected;
  const [query, setQuery] = useState('');
  const reposQuery = useGithubReposQuery(query || undefined, connected);
  const createFactory = useCreateGithubFactoryMutation();
  const repos = reposQuery.data ?? [];
  const loading = reposQuery.isPending;
  const error = reposQuery.error ?? createFactory.error;
  const busyRepoId = createFactory.isPending ? createFactory.variables?.id : null;

  useKeyDown({ escape: () => onClose() });

  const handlePick = async (repo: GithubRepo) => {
    try {
      const stored = await createFactory.mutateAsync(repo);
      onFactoryCreated(stored);
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

        {/* Status diagnostics — explain why GitHub is unavailable before the body */}
        <StatusCallout status={status} connected={connected} empty={connected && !loading && repos.length === 0} />

        {!connected ? (
          <>
            <p className="mb-4 mt-0 text-ui-sm leading-relaxed text-icon3">
              Install the MastraCode GitHub App to pick repositories you have access to and turn them into factories.
              Each repo is cloned into its own isolated cloud sandbox when you open it.
            </p>
            {/* Hide the connect button when the feature is disabled — /auth/github/connect won't exist */}
            {status.reason !== 'missing_config' && status.reason !== 'organization_required' && (
              <button
                className="inline-flex items-center justify-center rounded-lg bg-accent1 px-4 py-2 text-ui-sm font-medium text-black hover:bg-accent1/90"
                onClick={() => connectGithub(baseUrl)}
              >
                <span>Connect GitHub</span>
              </button>
            )}
          </>
        ) : (
          <>
            <p className="mb-4 mt-0 text-ui-sm leading-relaxed text-icon3">
              Choose a repository. It's cloned into an isolated cloud sandbox the first time you open the factory.
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
                <SkeletonRows label="Loading repositories" rows={3} rowClassName="h-12 w-full rounded-xl" />
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

            {/* Re-run the install flow: GitHub's own page adds/removes accounts
                and repo access; the callback re-syncs installations here. */}
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border1 pt-3">
              <span className="text-ui-xs text-icon3">Missing a repository or connected the wrong account?</span>
              <button
                className="shrink-0 rounded-lg border border-border1 bg-surface2 px-3 py-1.5 text-ui-xs font-medium text-icon6 hover:border-border2 hover:bg-surface4"
                onClick={() => manageGithubConnection(baseUrl)}
              >
                Manage GitHub connection
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Actionable diagnostic callout rendered before the connect/repo-picker body.
 * Explains the exact missing step so the user can fix it without curl/devtools.
 * Never shows secret values — only env var names, booleans, and public URLs.
 */
function StatusCallout({ status, connected, empty }: { status: GithubStatus; connected: boolean; empty: boolean }) {
  const calloutClass =
    'mb-4 rounded-lg border border-border1 bg-surface2 px-3 py-2 text-ui-sm leading-relaxed text-icon3';

  // Auth required: the session expired or was never established.
  if (status.authRequired) {
    return (
      <div className={calloutClass}>
        You need to sign in to use GitHub. Reload the page — if that doesn't work, sign out and back in.
      </div>
    );
  }

  // Feature disabled: missing env config on the server.
  if (status.reason === 'missing_config' && status.diagnostics) {
    const missing = status.diagnostics.missingGithubAppEnvVars;
    return (
      <div className={calloutClass}>
        <p className="m-0 mb-1">GitHub is disabled on the server.</p>
        {missing.length > 0 && (
          <p className="m-0 mb-1">
            Missing env vars: <code className="text-icon4">{missing.join(', ')}</code>
          </p>
        )}
        <p className="m-0">
          Edit <code className="text-icon4">src/web/.env</code> and restart <code className="text-icon4">web:dev</code>.
        </p>
      </div>
    );
  }

  // Organization required: signed in but no WorkOS org.
  if (status.organizationRequired || status.reason === 'organization_required') {
    return (
      <div className={calloutClass}>
        Your account has no WorkOS organization. GitHub factories require an org. Sign out and back in to auto-create
        one, or ask your admin to add you to an org.
      </div>
    );
  }

  // Not connected: app installed but no installation persisted (callback didn't complete).
  if (!connected && status.reason === 'not_connected') {
    return (
      <div className={calloutClass}>
        The GitHub App isn't connected yet. Click <strong>Connect GitHub</strong> to install it. After install, GitHub
        redirects to <code className="text-icon4">/auth/github/callback</code> — make sure that URL is registered in
        your GitHub App settings (Callback URL).
      </div>
    );
  }

  // Connected but no repos: installation may have no repo access.
  if (connected && empty) {
    return (
      <div className={calloutClass}>
        No repositories found. Your GitHub App installation may not have access to any repos. Check the installation's
        repository access at <code className="text-icon4">https://github.com/settings/installations</code> and grant
        access to at least one repo.
      </div>
    );
  }

  return null;
}
