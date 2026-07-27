export interface DataPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataPanelNoData({ children }: DataPanelNoDataProps) {
  return <p className="text-ui-sm text-neutral2 px-4 py-6">{children ?? 'No data found.'}</p>;
}
