export interface DataPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataPanelNoData({ children }: DataPanelNoDataProps) {
  return <p className="px-3 py-4 text-caption text-placeholder">{children ?? 'No data found.'}</p>;
}
