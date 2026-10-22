import { DataPanel } from '../../../ds/components/DataPanel';
import type { DataPanelCopyIdProps } from '../../../ds/components/DataPanel';

export function TraceIdButton({
  id,
  maxLength,
  ellipsis,
}: Pick<DataPanelCopyIdProps, 'id' | 'maxLength' | 'ellipsis'>) {
  return <DataPanel.CopyId id={id} maxLength={maxLength} ellipsis={ellipsis} />;
}
