export interface DataDetailsPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataDetailsPanelNoData({ children }: DataDetailsPanelNoDataProps) {
  return <p className="text-ui-sm text-neutral2 px-4 py-6">{children ?? 'No data found.'}</p>;
}
