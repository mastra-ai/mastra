import { useOverlays } from '../../../lib/overlays';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts overlays that intentionally sit above the application layout. */
export function ChatOverlays() {
  const overlays = useOverlays();
  return overlays.isOpen('shortcuts') ? <ShortcutsOverlay /> : null;
}
