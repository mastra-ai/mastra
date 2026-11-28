import { GlobalSearchOverlay } from '../../search/components/GlobalSearchOverlay';
import { useOverlays } from '@mastra/playground-ui/domains/factory/session/thread/chat/overlays';
import { ShortcutsOverlay } from './ShortcutsOverlay';

/** Mounts overlays that intentionally sit above the application layout. */
export function ChatOverlays() {
  const overlays = useOverlays();
  return (
    <>
      <GlobalSearchOverlay />
      {overlays.isOpen('shortcuts') && <ShortcutsOverlay />}
    </>
  );
}
