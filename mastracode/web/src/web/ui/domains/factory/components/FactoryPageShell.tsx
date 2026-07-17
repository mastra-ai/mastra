import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { useOverlays } from '../../../lib/overlays';
import { Sidebar } from '../../../Sidebar';
import { PageLayout } from '../../../ui';
import { ChatHeader } from '../../chat/components/ChatHeader';
import { EmptyProjectState, useActiveFactoryContext, useGithubStatusQuery } from '../../workspaces';
import type { GithubFactory } from '../../workspaces';
import { isGithubFactory } from '../../workspaces';

interface FactoryPageShellProps {
  title: string;
  description: string;
  /** Renders the page body once a GitHub-backed factory is active. */
  children: (factory: GithubFactory) => ReactNode;
}

/**
 * Shared frame for the Factory pages (the Board): the standard app
 * layout (sidebar + mobile header) around a titled content column. Factory data
 * comes from GitHub, so local factories and disconnected GitHub states get an
 * explanatory notice instead of a broken empty list.
 */
export function FactoryPageShell({ title, description, children }: FactoryPageShellProps) {
  const overlays = useOverlays();
  const { activeFactory } = useActiveFactoryContext();
  const githubFactory = activeFactory && isGithubFactory(activeFactory) ? activeFactory : undefined;
  const status = useGithubStatusQuery(Boolean(githubFactory));

  return (
    <PageLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      title={activeFactory ? title : undefined}
      description={activeFactory ? description : undefined}
    >
      {activeFactory ? (
        !githubFactory ? (
          <Notice variant="info">
            Factory is only available for GitHub factories. Switch to a GitHub-backed factory.
          </Notice>
        ) : status.isPending ? null : status.data?.enabled && status.data.connected ? (
          children(githubFactory)
        ) : (
          <Notice variant="info">
            Factory requires a GitHub connection. Connect GitHub from the factories menu to see issues and pull requests.
          </Notice>
        )
      ) : (
        <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
      )}
    </PageLayout>
  );
}
