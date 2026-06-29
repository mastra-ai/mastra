export interface DataPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataPanelNoData({ children }: DataPanelNoDataProps) {
  return <p className="px-4 py-6 text-ui-sm text-neutral2">{children ?? 'No data found.'}</p>;
}
