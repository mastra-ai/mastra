import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, ChevronsUpDown, Folder, FolderOpen } from 'lucide-react';

import { useGithubStatusQuery } from '../../../../../shared/hooks/useGithubStatus';
import { deriveProjectPath } from '../../../../../shared/hooks/useWorkspaces';
import { useOverlays } from '../../../lib/overlays';
import { GithubIcon } from '../../../ui/icons';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';

/** Inline project selection with dedicated actions for adding local and GitHub projects. */
export function ProjectSwitcher() {
  const { projects, activeProject, selectProject } = useActiveProjectContext();
  const overlays = useOverlays();
  const githubStatus = useGithubStatusQuery().data;
  const githubEnabled = !!githubStatus && (githubStatus.enabled || !!githubStatus.authRequired);

  return (
    <div className="flex flex-col gap-2">
      <Txt as="span" variant="ui-xs" className="px-1 text-icon3 uppercase tracking-wide">
        Project
      </Txt>
      <DropdownMenu>
        <DropdownMenu.Trigger
          aria-label="Select project"
          className="flex w-full items-center gap-2 rounded-md border border-border1 px-2.5 py-2 text-left hover:bg-surface3"
        >
          <Folder size={16} className="shrink-0 text-icon3" />
          <span className="flex min-w-0 flex-1 flex-col">
            <Txt as="span" variant="ui-sm" className="truncate text-icon6">
              {activeProject?.name ?? 'Select a project…'}
            </Txt>
            {activeProject && (
              <Txt as="span" variant="ui-xs" className="truncate text-icon3">
                {deriveProjectPath(activeProject)}
              </Txt>
            )}
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-icon3" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" className="w-64">
          {projects.map(project => (
            <DropdownMenu.Item key={project.id} onSelect={() => void selectProject(project)}>
              {project.source === 'github' ? <GithubIcon /> : <Folder />}
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {project.id === activeProject?.id && <Check aria-label="Active project" />}
            </DropdownMenu.Item>
          ))}
          {projects.length > 0 && <DropdownMenu.Separator />}
          <DropdownMenu.Item onSelect={() => overlays.open('projects')}>
            <FolderOpen />
            <span>Open local project</span>
          </DropdownMenu.Item>
          {githubEnabled && (
            <DropdownMenu.Item onSelect={() => overlays.open('github')}>
              <GithubIcon />
              <span>Open from GitHub</span>
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
