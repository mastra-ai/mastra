import { Button } from '@mastra/playground-ui/components/Button';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { useGithubReposQuery } from '../../../../hooks/useGithubRepos';
import { useGithubStatusQuery } from '../../../../hooks/useGithubStatus';
import { useLinkRepositoryMutation, useUnlinkRepositoryMutation } from '../../../../hooks/useFactories';
import { FolderIcon } from '../../../ui/icons';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { FactoryProject, GithubStatus } from '../services/github';
import { connectGithub } from '../services/github';

/**
 * Repository linking for a server-backed Factory. One list: the factory's
 * linked repositories first, then every repo the user's GitHub installations
 * can reach (link on click). When GitHub isn't connected the panel shows a
 * Connect GitHub CTA instead — it never hides the Factory itself.
 */
export function ConnectRepositoriesPanel({ factory }: { factory: FactoryProject }) {
  const { baseUrl } = useApiConfig();
  const statusQuery = useGithubStatusQuery();
  const status = statusQuery.data;
  const connected = !!status?.connected;
  const [query, setQuery] = useState('');
  const reposQuery = useGithubReposQuery(query || undefined, connected);
  const linkRepository = useLinkRepositoryMutation();
  const unlinkRepository = useUnlinkRepositoryMutation();

  const factoryProjectId = factory.id;
  const linked = factory.repositories;
  const linkedSlugs = new Set(linked.map(repo => repo.slug));
  const repos = reposQuery.data ?? [];
  const available = repos.filter(repo => !linkedSlugs.has(repo.fullName));
  // The repo list is filtered server-side; linked repos come from the factory, so filter them here.
  const normalizedQuery = query.trim().toLowerCase();
  const visibleLinked = normalizedQuery
    ? linked.filter(repo => repo.slug.toLowerCase().includes(normalizedQuery))
    : linked;

  const error = reposQuery.error ?? linkRepository.error ?? unlinkRepository.error;
  const busyRepoId = linkRepository.isPending ? linkRepository.variables?.repo.id : null;
  const unlinkingId = unlinkRepository.isPending ? unlinkRepository.variables?.projectRepositoryId : null;

  if (statusQuery.isPending) {
    return <SkeletonRows label="Loading GitHub status" rows={3} rowClassName="h-10 w-full rounded-xl" />;
  }

  return (
    <div className="flex min-w-0 flex-col" aria-label="Connect repositories">
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
          <div className="px-4 py-3">
            <Button variant="primary" onClick={() => connectGithub(baseUrl)}>
              <GithubIcon className="size-4" />
              Connect GitHub
            </Button>
          </div>
        )
      ) : (
        <>
          <div className="px-4 py-2">
            <ListSearch label="Search repositories" placeholder="Search…" size="sm" value={query} onSearch={setQuery} />
          </div>

          {error && (
            <Txt as="p" variant="ui-sm" className="text-notice-destructive-fg px-4 pb-2">
              {error.message}
            </Txt>
          )}

          <ScrollArea orientation="vertical" maxHeight="20rem">
            <div className="flex min-w-0 flex-col gap-px p-2">
              {visibleLinked.length > 0 && <ListHeading>Linked</ListHeading>}
              {visibleLinked.map(repo => (
                <div key={repo.projectRepositoryId} className="flex w-full items-center gap-3 rounded-md px-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="text-ui-md text-icon6 flex items-center gap-1.5">
                      <GithubIcon className="text-icon5 size-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{repo.slug}</span>
                    </span>
                    {repo.gitBranch && <span className="text-ui-sm text-icon3 block truncate">{repo.gitBranch}</span>}
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

              {reposQuery.isPending ? (
                <div className="px-2 py-2">
                  <SkeletonRows label="Loading repositories" rows={3} rowClassName="h-8 w-full rounded-md" />
                </div>
              ) : available.length === 0 ? (
                visibleLinked.length === 0 && (
                  <Txt as="p" variant="ui-sm" className="text-icon3 px-2 py-2">
                    {repos.length > 0 ? 'All available repositories are linked.' : 'No repositories found.'}
                  </Txt>
                )
              ) : (
                <>
                  {visibleLinked.length > 0 && <ListHeading>Available</ListHeading>}
                  {available.map(repo => (
                    <button
                      type="button"
                      key={repo.id}
                      className="hover:bg-surface-overlay-soft flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                      title={repo.fullName}
                      disabled={busyRepoId !== null}
                      onClick={() => linkRepository.mutate({ factoryProjectId, repo })}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-ui-md text-icon5 flex items-center gap-1.5">
                          <FolderIcon size={14} className="text-icon3 shrink-0" />
                          <span className="min-w-0 truncate">{repo.fullName}</span>
                        </span>
                        <span className="text-ui-sm text-icon3 block truncate">
                          {repo.private ? 'private' : 'public'} · {repo.defaultBranch}
                        </span>
                      </span>
                      {busyRepoId === repo.id && <span className="text-ui-sm text-icon3">Linking…</span>}
                    </button>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function ListHeading({ children }: { children: ReactNode }) {
  return (
    <Txt as="p" variant="ui-xs" className="text-icon3 px-2 pt-3 pb-1 first:pt-0">
      {children}
    </Txt>
  );
}

/**
 * Actionable diagnostic callout explaining why GitHub is unavailable (or why
 * the repo list is empty). Never shows secret values — only env var names,
 * booleans, and public URLs.
 */
function StatusCallout({ status, connected, empty }: { status: GithubStatus; connected: boolean; empty: boolean }) {
  const calloutClass = 'px-4 py-3 text-ui-sm leading-relaxed text-icon3';

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
          Set them in <code className="text-icon4">mastracode/web/.env</code>, register{' '}
          <code className="text-icon4">http://localhost:5173/auth/github/callback</code> as the GitHub App callback URL,
          then restart <code className="text-icon4">pnpm web:dev</code> from{' '}
          <code className="text-icon4">mastracode/web</code>.
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
