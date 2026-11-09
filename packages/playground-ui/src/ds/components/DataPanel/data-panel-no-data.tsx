import { Txt } from '@/ds/components/Txt';
export interface DataPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataPanelNoData({ children }: DataPanelNoDataProps) {
  return (
    <Txt variant="caption" tone="faint" className="px-3 py-4">
      {children ?? 'No data found.'}
    </Txt>
  );
}
