import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import { useRouteSidePanel } from '@/lib/route-side-panel';

/** Mirrors `[` (sidebar) on the right edge of the frame. */
export const OVERVIEW_PANEL_SHORTCUT = ']';

/**
 * `]` toggles the agent overview side panel. Rendered inside the agent
 * `KeyboardScope`, so the binding only exists while an agent page is mounted.
 * On mobile it opens and closes the drawer instead.
 */
export const OverviewPanelShortcuts = () => {
  const { toggle } = useRouteSidePanel();

  useKeydown({ [OVERVIEW_PANEL_SHORTCUT]: toggle });

  return null;
};
