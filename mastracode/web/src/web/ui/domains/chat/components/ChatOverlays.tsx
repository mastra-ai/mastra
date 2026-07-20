import { useOverlays } from '../../../lib/overlays';
import { SettingsPanel } from '../../settings';
import { FactoriesModal, GithubConnectModal, useActiveFactoryContext, useGithubStatusQuery } from '../../workspaces';
import { deriveFactoryOnboardingOpen, isGithubAvailable } from '../../workspaces/deriveFactoryOnboardingOpen';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { factories, factoriesPending, selectFactory } = useActiveFactoryContext();
  const githubQuery = useGithubStatusQuery();
  const githubStatus = githubQuery.data;
  const statusSettled = !githubQuery.isPending && (githubQuery.isFetched || githubQuery.isError);
  const githubAvailable = isGithubAvailable(githubStatus);

  const { local: factoriesOpen, github: githubOpen } = deriveFactoryOnboardingOpen({
    empty: factories.length === 0,
    factoriesSettled: !factoriesPending,
    explicitFactories: overlays.isOpen('factories'),
    explicitGithub: overlays.isOpen('github'),
    status: githubStatus,
    statusSettled,
    githubAvailable,
  });

  return (
    <>
      {overlays.isOpen('settings') && <SettingsPanel onClose={() => overlays.close('settings')} />}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
      {factoriesOpen && <FactoriesModal onOpenGithub={githubAvailable ? () => overlays.open('github') : undefined} />}

      {githubOpen && githubStatus && (
        <GithubConnectModal
          status={githubStatus}
          onFactoryCreated={factory => void selectFactory(factory)}
          onClose={() => overlays.close('github')}
          onOpenLocal={() => {
            overlays.close('github');
            overlays.open('factories');
          }}
        />
      )}
    </>
  );
}
