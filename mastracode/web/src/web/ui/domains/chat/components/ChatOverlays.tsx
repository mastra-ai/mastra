import { useOverlays } from '../../../lib/overlays';
import { SettingsPanel } from '../../settings';
import { FactoriesModal, useActiveFactoryContext } from '../../workspaces';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts the active chat overlays. Each overlay owns its provider-backed behavior. */
export function ChatOverlays() {
  const overlays = useOverlays();
  const { factories, factoriesPending } = useActiveFactoryContext();

  // Wait for backend hydration before treating an empty local cache as
  // first-run state.
  const factoriesOpen = overlays.isOpen('factories') || (factories.length === 0 && !factoriesPending);

  return (
    <>
      {overlays.isOpen('settings') && <SettingsPanel onClose={() => overlays.close('settings')} />}
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
      {factoriesOpen && <FactoriesModal />}
    </>
  );
}
