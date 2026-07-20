import { useOverlays } from '../../../lib/overlays';
import { SettingsPanel } from '../../settings';
import { FactoriesModal, GithubConnectModal, useActiveFactoryContext, useGithubStatusQuery } from '../../workspaces';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { factories, factoriesPending, selectFactory } = useActiveFactoryContext();
  const githubStatus = useGithubStatusQuery().data;
  const githubEnabled = !!githubStatus && (githubStatus.enabled || !!githubStatus.authRequired);

  // The GitHub repo picker replaces the factories modal while open. Wait for
  // backend hydration before treating an empty local cache as first-run state.
  const factoriesOpen =
    (overlays.isOpen('factories') || (factories.length === 0 && !factoriesPending)) && !overlays.isOpen('github');

  return (
    <>
      {overlays.isOpen('settings') && <SettingsPanel onClose={() => overlays.close('settings')} />}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
      {factoriesOpen && <FactoriesModal onOpenGithub={githubEnabled ? () => overlays.open('github') : undefined} />}

      {overlays.isOpen('github') && githubStatus && (
        <GithubConnectModal
          status={githubStatus}
          onFactoryCreated={factory => void selectFactory(factory)}
          onClose={() => overlays.close('github')}
        />
      )}
    </>
  );
}
