import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronsUpDown, Folder, Plus } from 'lucide-react';

import { useOverlays } from '../../../lib/overlays';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';
import { deriveProjectPath } from '../hooks/useWorkspaces';

/**
 * Propless project switcher: shows the active project and opens the projects
 * modal. Opening the modal also closes the sidebar drawer (mobile behavior).
 */
export function ProjectSwitcher() {
  const { activeProject } = useActiveProjectContext();
  const overlays = useOverlays();

  const manageProjects = () => {
    overlays.open('projects');
    overlays.close('sidebar');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          Project
        </Txt>
        <Button variant="ghost" size="icon-sm" aria-label="Manage projects" onClick={manageProjects}>
          <Plus size={15} />
        </Button>
      </div>

      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-md border border-border1 bg-surface3 px-2.5 py-2 text-left transition-colors hover:bg-surface4"
        onClick={manageProjects}
        title={activeProject ? deriveProjectPath(activeProject) : 'Select a project'}
      >
        <Folder size={16} className="shrink-0 text-icon3" />
        <span className="flex min-w-0 flex-1 flex-col">
          {activeProject ? (
            <>
              <Txt as="span" variant="ui-sm" className="truncate text-icon6">
                {activeProject.name}
              </Txt>
              <Txt as="span" variant="ui-xs" className="truncate text-icon3">
                {deriveProjectPath(activeProject)}
              </Txt>
            </>
          ) : (
            <Txt as="span" variant="ui-sm" className="text-icon3">
              Select a project…
            </Txt>
          )}
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-icon3" />
      </button>
    </div>
  );
}
