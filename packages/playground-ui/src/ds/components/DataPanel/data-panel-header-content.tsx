export interface DataPanelHeaderContentProps {
  children: React.ReactNode;
}

/** Left block of a `DataPanel.Header`: heading on top, optional `Metadata` below. */
export function DataPanelHeaderContent({ children }: DataPanelHeaderContentProps) {
  return <div className="flex min-w-0 flex-1 flex-col justify-center gap-0">{children}</div>;
}
