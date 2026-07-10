import { useOverlays } from '../../../lib/overlays';
import { SettingsPanel } from '../../settings';
import { ProjectsModal, useActiveProjectContext } from '../../workspaces';
import { CommandPalette } from './CommandPalette';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { activeProject, projects } = useActiveProjectContext();

  return (
    <>
      {overlays.isOpen('palette') && activeProject && <CommandPalette />}
      {overlays.isOpen('settings') && <SettingsPanel />}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
      {(overlays.isOpen('projects') || projects.length === 0) && <ProjectsModal />}
    </>
  );
}
