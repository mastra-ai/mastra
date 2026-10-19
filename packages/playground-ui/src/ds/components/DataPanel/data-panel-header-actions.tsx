export interface DataPanelHeaderActionsProps {
  children: React.ReactNode;
}

/**
 * Right-side action slot of a `DataPanel.Header`. Mirrors `HeaderAction` with `gap-2`
 * (these are `size="sm"` controls, like the page header actions) and wraps when the panel is too narrow.
 */
export function DataPanelHeaderActions({ children }: DataPanelHeaderActionsProps) {
  return (
    <div
      data-slot="data-panel-header-actions"
      // Header wrapped: the actions keep one row beside the heading; the heading gives up its space first.
      className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 self-center group-data-wrapped/data-panel-header:shrink-0 group-data-wrapped/data-panel-header:flex-nowrap"
    >
      {children}
    </div>
  );
}
