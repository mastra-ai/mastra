import { MemoryStudioPanel } from './memory-studio-panel';
import type { MemoryStudioPanelProps } from './memory-studio-panel';

export type MemoryDetailPanelProps = MemoryStudioPanelProps;

export function MemoryDetailPanel(props: MemoryDetailPanelProps) {
  return (
    <div data-testid="memory-sidebar-om-detail-subpanel" className="h-full min-h-0 min-w-0 overflow-hidden bg-card">
      <MemoryStudioPanel {...props} />
    </div>
  );
}
