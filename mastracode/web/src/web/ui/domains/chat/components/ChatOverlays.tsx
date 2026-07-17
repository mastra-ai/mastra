import { useEffect } from 'react';

import { useOverlays } from '../../../lib/overlays';
import { useToast } from '../../../ui';
import { SettingsPanel } from '../../settings';
import { FactoriesModal, GithubConnectModal, useActiveFactoryContext, useGithubStatusQuery } from '../../workspaces';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { factories, selectFactory, preparing, prepareError } = useActiveFactoryContext();
  const { toast } = useToast();
  const githubStatus = useGithubStatusQuery().data;

  // The GitHub repo picker replaces the factories modal while open.
  const factoriesOpen = (overlays.isOpen('factories') || factories.length === 0) && !overlays.isOpen('github');

  // Materialization failures surface as a toast; selection already stays put.
  // Keyed on the error identity only — `toast` is not referentially stable, and
  // including it would re-fire the same toast on unrelated re-renders.
  useEffect(() => {
    if (prepareError) toast(prepareError.message, 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepareError]);

  return (
    <>
      {overlays.isOpen('settings') && <SettingsPanel onClose={() => overlays.close('settings')} />}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
      {factoriesOpen && <FactoriesModal />}

      {overlays.isOpen('github') && githubStatus && (
        <GithubConnectModal
          status={githubStatus}
          onFactoryCreated={factory => void selectFactory(factory)}
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
