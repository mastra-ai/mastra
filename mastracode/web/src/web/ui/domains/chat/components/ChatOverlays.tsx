import { useOverlays } from '../../../lib/overlays';
import { SettingsPanel } from '../../settings';
import { GithubConnectModal, ProjectsModal, useActiveProjectContext, useGithubStatusQuery } from '../../workspaces';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { projects, projectsPending, selectProject } = useActiveProjectContext();
  const githubStatusQuery = useGithubStatusQuery();
  const githubStatus = githubStatusQuery.data;

  // Wait for backend projects and GitHub capability before choosing the first-run UI.
  // An explicitly requested local picker still opens immediately.
  const projectsOpen =
    (overlays.isOpen('projects') ||
      (!projectsPending && !githubStatusQuery.isPending && projects.length === 0 && !overlays.isOpen('github'))) &&
    !overlays.isOpen('github');

  return (
    <>
      {overlays.isOpen('settings') && <SettingsPanel onClose={() => overlays.close('settings')} />}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
      {projectsOpen &&
        (githubStatus?.enabled ? (
          <ProjectsModal
            onOpenGithub={() => {
              overlays.close('projects');
              overlays.open('github');
            }}
          />
        ) : (
          <ProjectsModal />
        ))}

      {overlays.isOpen('github') && githubStatus && (
        <GithubConnectModal
          status={githubStatus}
          onProjectCreated={project => void selectProject(project)}
          onClose={() => overlays.close('github')}
        />
      )}
    </>
  );
}
