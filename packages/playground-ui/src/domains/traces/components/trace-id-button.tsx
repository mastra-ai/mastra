import { DataPanel } from '@/ds/components/DataPanel';

export function TraceIdButton({ id }: { id: string }) {
  return <DataPanel.CopyId id={id} />;
}
