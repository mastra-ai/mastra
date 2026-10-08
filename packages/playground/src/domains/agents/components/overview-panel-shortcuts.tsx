import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';

/** Mirrors `[` (sidebar) with chat's floating Config panel. */
export const OVERVIEW_PANEL_SHORTCUT = ']';

/** Mounted only in chat; editable fields are ignored by the shared keyboard layer. */
export const OverviewPanelShortcuts = ({ onToggle }: { onToggle: () => void }) => {
  useKeydown({ [OVERVIEW_PANEL_SHORTCUT]: onToggle });

  return null;
};
