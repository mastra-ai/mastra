export interface DataPanelHeaderActionsProps {
  children: React.ReactNode;
}

/**
 * Right-side action slot of a `DataPanel.Header`. Mirrors `HeaderAction` with `gap-2`
 * (these are `size="sm"` controls, like the page header actions) and wraps when the panel is too narrow.
 */
export function DataPanelHeaderActions({ children }: DataPanelHeaderActionsProps) {
  return <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2 self-center">{children}</div>;
}
