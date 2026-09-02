export interface DataPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataPanelNoData({ children }: DataPanelNoDataProps) {
  return <p className="text-ui-sm px-4 py-6 text-(--text-secondary)">{children ?? 'No data found.'}</p>;
}
