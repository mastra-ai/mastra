export interface DataDetailsPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataDetailsPanelNoData({ children }: DataDetailsPanelNoDataProps) {
  return <p className="px-4 py-6 text-ui-sm text-neutral2">{children ?? 'No data found.'}</p>;
}
