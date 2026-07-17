import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { useOverlays } from '../../../lib/overlays';
import { Sidebar } from '../../../Sidebar';
import { PageLayout } from '../../../ui';
import { ChatHeader } from '../../chat/components/ChatHeader';
import { EmptyProjectState, useActiveProjectContext, useGithubStatusQuery } from '../../workspaces';
import type { Project } from '../../workspaces';

interface FactoryPageShellProps {
  title: string;
  description: string;
  /** Renders the page body once a GitHub-backed project is active. */
  children: (project: Project & { githubProjectId: string }) => ReactNode;
}

/**
 * Shared frame for the Factory pages (the Board): the standard app
 * layout (sidebar + mobile header) around a titled content column. Factory data
 * comes from GitHub, so local projects and disconnected GitHub states get an
 * explanatory notice instead of a broken empty list.
 */
export function FactoryPageShell({ title, description, children }: FactoryPageShellProps) {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();
  const isGithubProject = activeProject?.source === 'github' && Boolean(activeProject.githubProjectId);
  const status = useGithubStatusQuery(isGithubProject);

  return (
    <PageLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      title={activeProject ? title : undefined}
      description={activeProject ? description : undefined}
    >
      {activeProject ? (
        !isGithubProject || !activeProject.githubProjectId ? (
          <Notice variant="info">
            Factory is only available for GitHub projects. Switch to a GitHub-backed project.
          </Notice>
        ) : status.isPending ? null : status.data?.enabled && status.data.connected ? (
          children({ ...activeProject, githubProjectId: activeProject.githubProjectId })
        ) : (
          <Notice variant="info">
            Factory requires a GitHub connection. Connect GitHub from the projects menu to see issues and pull requests.
          </Notice>
        )
      ) : (
        <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
      )}
    </PageLayout>
  );
}
