import { useOverlays } from '../../../lib/overlays';
import { SettingsPanel } from '../../settings';
import { ProjectsModal, useActiveProjectContext } from '../../workspaces';
import { CommandPalette } from './CommandPalette';
import { ShortcutsOverlay } from './ShortcutsOverlay';

export function ChatOverlays() {
  const overlays = useOverlays();
  const { projects, activeProject, selectProject } = useActiveProjectContext();
  const projectsOpen = overlays.isOpen('projects') || projects.length === 0;

  return (
    <>
      {overlays.isOpen('palette') && activeProject && <CommandPalette onClose={() => overlays.close('palette')} />}

      {overlays.isOpen('settings') && <SettingsPanel onClose={() => overlays.close('settings')} />}

      {overlays.isOpen('shortcuts') && <ShortcutsOverlay onClose={() => overlays.close('shortcuts')} />}

      {projectsOpen && (
        <ProjectsModal
          projects={projects}
          activeProjectId={activeProject?.id ?? null}
          onSelectProject={project => void selectProject(project)}
          onClose={() => overlays.close('projects')}
        />
      )}
    </>
  );
}
