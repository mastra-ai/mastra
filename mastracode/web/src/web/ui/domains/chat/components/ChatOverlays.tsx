import { useOverlays } from '../../../lib/overlays';
import { SettingsPanel } from '../../settings/components/SettingsPanel';
import { GithubConnectModal } from '../../workspaces/components/GithubConnectModal';
import { useActiveFactoryContext } from '../../workspaces/context/ActiveFactoryProvider';
import { useGithubStatusQuery } from '../../../../../shared/hooks/useGithubStatus';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { selectFactory } = useActiveFactoryContext();
  const githubStatus = useGithubStatusQuery().data;
  return (
    <>
      {overlays.isOpen('settings') && <SettingsPanel onClose={() => overlays.close('settings')} />}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}

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
