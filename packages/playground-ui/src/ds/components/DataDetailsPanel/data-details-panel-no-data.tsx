export interface DataDetailsPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataDetailsPanelNoData({ children }: DataDetailsPanelNoDataProps) {
  return <p className="px-4 py-6 text-caption text-placeholder">{children ?? 'No data found.'}</p>;
}
