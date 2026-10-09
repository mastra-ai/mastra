import { Txt } from '@/ds/components/Txt';
export interface DataDetailsPanelNoDataProps {
  children?: React.ReactNode;
}

export function DataDetailsPanelNoData({ children }: DataDetailsPanelNoDataProps) {
  return (
    <Txt variant="caption" tone="faint" className="px-4 py-6">
      {children ?? 'No data found.'}
    </Txt>
  );
}
