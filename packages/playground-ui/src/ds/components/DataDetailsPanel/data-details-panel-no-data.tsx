export interface DataDetailsPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataDetailsPanelNoData({ children }: DataDetailsPanelNoDataProps) {
  return <p className="text-ui-sm px-4 py-6 text-(--text-secondary)">{children ?? 'No data found.'}</p>;
}
