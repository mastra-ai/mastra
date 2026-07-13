import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import { useOverlays } from '../../../lib/overlays';
import { Sidebar } from '../../../Sidebar';
import { ChatLayout } from '../../../ui';
import { ChatHeader } from '../../chat/components/ChatHeader';
import { EmptyProjectState, useActiveProjectContext, useGithubStatusQuery } from '../../workspaces';
import type { Project } from '../../workspaces';

interface FactoryPageShellProps {
  title: string;
  description: string;
  /** Max-width utility for the content column (defaults to `max-w-3xl`). */
  maxWidthClassName?: string;
  /** Renders the page body once a GitHub-backed project is active. */
  children: (project: Project & { githubProjectId: string }) => ReactNode;
}

/**
 * Shared frame for the Factory pages (Intake / Review): the standard app
 * layout (sidebar + mobile header) around a titled content column. Factory data
 * comes from GitHub, so local projects and disconnected GitHub states get an
 * explanatory notice instead of a broken empty list.
 */
export function FactoryPageShell({
  title,
  description,
  maxWidthClassName = 'max-w-3xl',
  children,
}: FactoryPageShellProps) {
  const overlays = useOverlays();
  const { activeProject } = useActiveProjectContext();
  const isGithubProject = activeProject?.source === 'github' && Boolean(activeProject.githubProjectId);
  const status = useGithubStatusQuery(isGithubProject);

  return (
    <ChatLayout
      sidebar={<Sidebar />}
      header={<ChatHeader />}
      sidebarOpen={overlays.isOpen('sidebar')}
      onSidebarClose={() => overlays.close('sidebar')}
      content={
        activeProject ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
            <div className={`mx-auto flex w-full flex-col gap-4 ${maxWidthClassName}`}>
              <header className="flex flex-col gap-1">
                <h1 className="m-0 text-xl text-icon6">{title}</h1>
                <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                  {description}
                </Txt>
              </header>
              {!isGithubProject || !activeProject.githubProjectId ? (
                <Notice variant="info">
                  Factory is only available for GitHub projects. Switch to a GitHub-backed project.
                </Notice>
              ) : status.isPending ? null : status.data?.enabled && status.data.connected ? (
                children({ ...activeProject, githubProjectId: activeProject.githubProjectId })
              ) : (
                <Notice variant="info">
                  Factory requires a GitHub connection. Connect GitHub from the projects menu to see issues and pull
                  requests.
                </Notice>
              )}
            </div>
          </div>
        ) : (
          <EmptyProjectState onOpenProjects={() => overlays.open('projects')} />
        )
      }
      footer={null}
    />
  );
}
