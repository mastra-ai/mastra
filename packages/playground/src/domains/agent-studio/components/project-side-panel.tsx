import type { ProjectResponse } from '@mastra/client-js';
import { ProjectTasksSection } from './project-tasks-panel';
import { ProjectTeamPanel } from './project-team-panel';

export interface ProjectSidePanelProps {
  project: ProjectResponse;
  canEdit: boolean;
}

/**
 * Unified right-side panel for the project chat. Holds the team (invited
 * agents) on top and the task list below, so the project page has a single
 * sidebar instead of separate team / task / thread panels.
 */
export function ProjectSidePanel({ project, canEdit }: ProjectSidePanelProps) {
  return (
    <aside className="flex flex-col gap-4 p-3 h-full overflow-auto" data-testid="project-side-panel">
      <ProjectTeamPanel project={project} canEdit={canEdit} />
      <div className="h-px bg-border1" />
      <ProjectTasksSection project={project} />
    </aside>
  );
}
