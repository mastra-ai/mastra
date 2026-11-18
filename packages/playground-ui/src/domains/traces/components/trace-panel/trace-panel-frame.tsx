import type { ReactNode } from 'react';

import { useTracePanel } from './trace-panel-context';
import { DataPanel } from '@/ds/components/DataPanel';
import type { DataPanelDrawerProps } from '@/ds/components/DataPanel';

export interface TracePanelFrameProps {
  /**
   * `drawer` (default): a modal side drawer, open while the root has a trace. `inline`: a card rendered
   * where it is mounted, e.g. inside an app's own frame; give its parent a bounded height.
   */
  variant?: 'drawer' | 'inline';
  /** Accessible name; defaults to the trace id. */
  title?: string;
  /** Drawer width; defaults to `wide` since the panel lays out several columns. */
  size?: DataPanelDrawerProps['size'];
  /** Drawer elevation when opened next to sibling drawers. */
  depth?: DataPanelDrawerProps['depth'];
  className?: string;
  /** The panel's rows: header, summary, body. Rendered only while the root has a trace. */
  children: ReactNode;
}

/** The card that frames the trace: a drawer that animates in and out with the root's trace, or an inline card. */
export function TracePanelFrame({
  variant = 'drawer',
  title,
  size = 'wide',
  depth,
  className,
  children,
}: TracePanelFrameProps) {
  const { traceId, onClose } = useTracePanel();
  const name = title ?? `Trace ${traceId}`;
  if (variant === 'inline') {
    if (!traceId) return null;
    return (
      <DataPanel variant="inline" title={name} className={className}>
        {children}
      </DataPanel>
    );
  }
  return (
    <DataPanel open={!!traceId} onClose={onClose} title={name} size={size} depth={depth} className={className}>
      {traceId ? children : null}
    </DataPanel>
  );
}
