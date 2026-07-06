import { useKeyDown } from '../../../lib/hooks';
import { useOverlays } from '../../../lib/overlays';
import { useActiveProjectContext } from '../../workspaces';
import { useChatSession } from '../context/ChatSessionProvider';

/**
 * App-wide keyboard shortcuts. Zero-args: observes overlay state via
 * `useOverlays()`, run state via `useChatSession()`, and the zero-projects
 * rule via `useActiveProjectContext()` (with no projects the projects modal
 * is forced open, so Escape must be a no-op).
 */
export function useGlobalShortcuts() {
  const overlays = useOverlays();
  const { projects } = useActiveProjectContext();
  const { busy, abort } = useChatSession();

  useKeyDown({
    'mod+k': e => {
      e.preventDefault();
      overlays.toggle('palette');
    },
    '?': e => {
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (typing || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      overlays.toggle('shortcuts');
    },
    escape: () => {
      const projectsForcedOpen = overlays.isOpen('projects') || projects.length === 0;
      if (projectsForcedOpen) return;
      if (overlays.isOpen('shortcuts')) {
        overlays.close('shortcuts');
        return;
      }
      if (overlays.isOpen('settings')) {
        overlays.close('settings');
        return;
      }
      if (overlays.isOpen('palette')) {
        overlays.close('palette');
        return;
      }
      if (overlays.isOpen('sidebar')) {
        overlays.close('sidebar');
        return;
      }
      if (busy) void abort();
    },
  });
}
