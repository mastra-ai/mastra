import { useEffect, useEffectEvent } from 'react';

import { useOverlays } from '../../../lib/overlays/overlays';
import { useToast } from '../../../ui/toast';
import { SettingsPanel } from '../../settings/components/SettingsPanel';
import { GithubConnectModal } from '../../workspaces/components/GithubConnectModal';
import { ProjectsModal } from '../../workspaces/components/ProjectsModal';
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { useGithubStatusQuery } from '../../workspaces/hooks/useGithubStatus';
import { CommandPalette } from './CommandPalette';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { activeProject, projects, selectProject, preparing, prepareError } = useActiveProjectContext();
  const { toast } = useToast();
  const githubStatus = useGithubStatusQuery().data;
  const showPrepareError = useEffectEvent((message: string) => toast(message, 'error'));

  // The GitHub repo picker replaces the projects modal while open.
  const projectsOpen = (overlays.isOpen('projects') || projects.length === 0) && !overlays.isOpen('github');
  const providerSettingsOpen = overlays.isOpen('provider-settings');
  const modelSettingsOpen = overlays.isOpen('model-settings');
  const settingsOpen = overlays.isOpen('settings') || modelSettingsOpen || providerSettingsOpen;

  useEffect(() => {
    if (prepareError) showPrepareError(prepareError.message);
  }, [prepareError]);

  return (
    <>
      {overlays.isOpen('palette') && activeProject && <CommandPalette />}
      {settingsOpen && (
        <SettingsPanel
          initialTab={providerSettingsOpen ? 'providers' : modelSettingsOpen ? 'model' : 'general'}
          onClose={() => {
            overlays.close('settings');
            overlays.close('model-settings');
            overlays.close('provider-settings');
          }}
        />
      )}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
      {projectsOpen && <ProjectsModal />}

      {overlays.isOpen('github') && githubStatus && (
        <GithubConnectModal
          status={githubStatus}
          onProjectCreated={project => void selectProject(project)}
          onClose={() => overlays.close('github')}
        />
      )}

      {preparing && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border1 bg-surface3 px-4 py-2 text-ui-sm text-icon5 shadow-lg"
        >
          <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent1" aria-hidden />
          <span className="truncate">{preparing.message}</span>
        </div>
      )}
    </>
  );
}
