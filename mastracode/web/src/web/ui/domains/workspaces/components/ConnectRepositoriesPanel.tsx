import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useGithubReposQuery } from '../../../../../shared/hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../../shared/hooks/useGithubStatus';
import { useLinkRepositoryMutation, useUnlinkRepositoryMutation } from '../../../../../shared/hooks/useFactories';
import { FolderIcon, GithubIcon, SearchIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { ServerFactory } from '../services/factories';
import type { GithubStatus } from '../services/github';
import { connectGithub, manageGithubConnection } from '../services/github';

/**
 * Repository linking for a server-backed Factory. Lists the factory's linked
 * repositories (with unlink), plus every repo the user's GitHub installations
 * can reach (link on click). When GitHub isn't connected the panel shows a
 * Connect GitHub CTA instead — it never hides the Factory itself.
 *
 * Embedded in the Board's no-repository empty state and in Factory settings.
 */
export function ConnectRepositoriesPanel({ factory }: { factory: ServerFactory }) {
  const { baseUrl } = useApiConfig();
  const statusQuery = useGithubStatusQuery();
  const status = statusQuery.data;
  const connected = !!status?.connected;
  const [query, setQuery] = useState('');
  const reposQuery = useGithubReposQuery(query || undefined, connected);
  const linkRepository = useLinkRepositoryMutation();
  const unlinkRepository = useUnlinkRepositoryMutation();

  const factoryProjectId = factory.binding.factoryProjectId;
  const linked = factory.binding.repositories;
  const linkedSlugs = new Set(linked.map(repo => repo.slug));
  const repos = reposQuery.data ?? [];
  const available = repos.filter(repo => !linkedSlugs.has(repo.fullName));

  const error = reposQuery.error ?? linkRepository.error ?? unlinkRepository.error;
  const busyRepoId = linkRepository.isPending ? linkRepository.variables?.repo.id : null;
  const unlinkingId = unlinkRepository.isPending ? unlinkRepository.variables?.projectRepositoryId : null;

  if (statusQuery.isPending) {
    return <SkeletonRows label="Loading GitHub status" rows={3} rowClassName="h-10 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-4" aria-label="Connect repositories">
      {/* Re-run the install flow: GitHub's own page adds/removes accounts and
          repo access; the callback re-syncs installations here. Kept available
          whenever connected — including with zero linked/accessible repos, so
          the user can always grant access — never hidden behind the list. */}
      {connected && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => manageGithubConnection(baseUrl)}>
            Manage GitHub connection
          </Button>
        </div>
      )}

      {linked.length > 0 && (
        <div className="flex flex-col gap-2">
          <Txt as="h3" variant="ui-sm" className="font-medium text-icon5">
            Linked repositories
          </Txt>
          {linked.map(repo => (
            <div
              key={repo.projectRepositoryId}
              className="flex items-center gap-3 rounded-xl border border-border1 bg-surface2 px-3 py-2"
            >
              <GithubIcon size={16} className="shrink-0 text-icon3" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui-sm font-medium text-icon6">{repo.slug}</span>
                {repo.gitBranch && <span className="block truncate text-ui-xs text-icon3">{repo.gitBranch}</span>}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={unlinkingId !== null}
                onClick={() =>
                  unlinkRepository.mutate({ factoryProjectId, projectRepositoryId: repo.projectRepositoryId })
                }
              >
                {unlinkingId === repo.projectRepositoryId ? 'Unlinking…' : 'Unlink'}
              </Button>
            </div>
          ))}
        </div>
      )}

      {status && (
        <StatusCallout
          status={status}
          connected={connected}
          empty={connected && !reposQuery.isPending && repos.length === 0}
        />
      )}

      {!connected ? (
        status &&
        status.reason !== 'missing_config' &&
        status.reason !== 'organization_required' && (
          <div>
            <Button variant="primary" onClick={() => connectGithub(baseUrl)}>
              <GithubIcon />
              Connect GitHub
            </Button>
          </div>
        )
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-border1 bg-surface2 px-3 py-2">
            <SearchIcon size={15} className="shrink-0 text-icon2" />
            <input
              className="min-w-0 flex-1 bg-transparent text-ui-sm text-icon6 placeholder:text-icon2 focus:outline-none"
              type="text"
              placeholder="Filter repositories…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </div>

          {error && (
            <Txt as="p" variant="ui-sm" className="m-0 text-notice-destructive-fg">
              {error.message}
            </Txt>
          )}

          <div className="flex max-h-80 min-h-0 flex-col gap-2 overflow-y-auto">
            {reposQuery.isPending ? (
              <SkeletonRows label="Loading repositories" rows={3} rowClassName="h-12 w-full rounded-xl" />
            ) : available.length === 0 ? (
              <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                {repos.length > 0 ? 'All available repositories are linked.' : 'No repositories found.'}
              </Txt>
            ) : (
              available.map(repo => (
                <div
                  key={repo.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface4"
                  title={repo.fullName}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-ui-sm font-medium text-icon6">
                      <FolderIcon size={14} className="shrink-0 text-icon3" />
                      <span className="truncate">{repo.fullName}</span>
                    </span>
                    <span className="block truncate text-ui-xs text-icon3">
                      {repo.private ? 'private' : 'public'} · {repo.defaultBranch}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyRepoId !== null}
                    onClick={() => linkRepository.mutate({ factoryProjectId, repo })}
                  >
                    {busyRepoId === repo.id ? 'Linking…' : 'Link'}
                  </Button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Actionable diagnostic callout explaining why GitHub is unavailable (or why
 * the repo list is empty). Never shows secret values — only env var names,
 * booleans, and public URLs.
 */
function StatusCallout({ status, connected, empty }: { status: GithubStatus; connected: boolean; empty: boolean }) {
  const calloutClass = 'rounded-lg border border-border1 bg-surface2 px-3 py-2 text-ui-sm leading-relaxed text-icon3';

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
        Your account has no WorkOS organization. Connecting repositories requires an org. Sign out and back in to
        auto-create one, or ask your admin to add you to an org.
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
