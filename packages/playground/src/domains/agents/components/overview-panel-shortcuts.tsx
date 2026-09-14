import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useRouteSidePanel } from '@/lib/route-side-panel';

/** Mirrors `[` (sidebar) on the right edge of the frame. */
export const OVERVIEW_PANEL_SHORTCUT = ']';

/**
 * `]` toggles the agent config side panel. Rendered inside the agent
 * `KeyboardScope`, so the binding only exists while an agent page is mounted.
 * On mobile the panel is a drawer and the handle is null, so it's a no-op there.
 */
export const OverviewPanelShortcuts = () => {
  const { toggle } = useRouteSidePanel();

  useKeydown({ [OVERVIEW_PANEL_SHORTCUT]: toggle });

  return null;
};
