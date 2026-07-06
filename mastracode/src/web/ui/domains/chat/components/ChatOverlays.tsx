import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';

import { useOverlays } from '../../../lib/overlays';
import { useToast } from '../../../ui';
import { SettingsPanel, useDensityPreference } from '../../settings';
import { ProjectsModal, useActiveProjectContext } from '../../workspaces';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatSession } from '../context/ChatSessionProvider';
import { CommandPalette } from './CommandPalette';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Chat-page overlays: command palette, settings, shortcuts, and projects. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { projects, activeProject, activeProjectId, resourceId, sessionEnabled, selectProject } =
    useActiveProjectContext();
  const session = useChatSession();
  const { runPaletteCommand } = useChatCommands();
  const { theme, setTheme } = useTheme();
  const { density, changeDensity } = useDensityPreference();
  const { toast } = useToast();

  // Derived: with zero projects the modal is forced open (closing is a no-op).
  const projectsOpen = overlays.isOpen('projects') || projects.length === 0;

  return (
    <>
      {overlays.isOpen('palette') && activeProject && (
        <CommandPalette onRun={runPaletteCommand} onClose={() => overlays.close('palette')} />
      )}

      {overlays.isOpen('settings') && (
        <SettingsPanel
          theme={theme}
          density={density}
          models={session.models}
          currentModelId={session.transcript.modelId ?? null}
          settings={session.settings}
          resourceId={sessionEnabled ? resourceId : undefined}
          onThemeChange={setTheme}
          onDensityChange={changeDensity}
          onModelChange={modelId => {
            void session.switchModel(modelId);
            toast('Model updated', 'success');
          }}
          onBehaviorChange={updates => {
            void session.setState(updates).then(() => toast('Settings updated', 'success'));
          }}
          permissions={session.permissions}
          pendingPermissionCategory={session.pendingPermissionCategory}
          setPermissionForCategory={session.setPermissionForCategory}
          onClose={() => overlays.close('settings')}
        />
      )}

      {overlays.isOpen('shortcuts') && <ShortcutsOverlay onClose={() => overlays.close('shortcuts')} />}

      {projectsOpen && (
        <ProjectsModal
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={project => void selectProject(project)}
          onClose={() => overlays.close('projects')}
        />
      )}
    </>
  );
}
