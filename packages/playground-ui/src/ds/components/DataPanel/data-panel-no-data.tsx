export interface DataPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataPanelNoData({ children }: DataPanelNoDataProps) {
  return <p className="text-caption text-placeholder px-3 py-4">{children ?? 'No data found.'}</p>;
}
