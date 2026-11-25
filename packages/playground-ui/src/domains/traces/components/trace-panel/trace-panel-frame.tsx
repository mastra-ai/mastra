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
  /** Above the header, e.g. the feedback the reader came from. */
  banner?: ReactNode;
  /** Typically a `TracePanel.Header`. */
  header?: ReactNode;
  /** Typically a `TracePanel.Summary`. */
  summary?: ReactNode;
  /** Typically a `TracePanel.Body`. */
  body?: ReactNode;
  /**
   * Dialogs opened from the panel, e.g. `TracePanel.ScoreDialog`. They render next to the frame rather
   * than inside it, so a modal drawer never leaves their content inert.
   */
  dialogs?: ReactNode;
}

/**
 * The card that frames the trace and lays its rows out top to bottom: banner, header, summary, body. A
 * drawer animates in and out with the root's trace; an inline card renders while there is one.
 */
export function TracePanelFrame({
  variant = 'drawer',
  title,
  size = 'wide',
  depth,
  className,
  banner,
  header,
  summary,
  body,
  dialogs,
}: TracePanelFrameProps) {
  const { traceId, onClose } = useTracePanel();
  const name = title ?? `Trace ${traceId}`;
  const rows = traceId ? (
    <>
      {banner}
      {header}
      {summary}
      {body}
    </>
  ) : null;

  if (variant === 'inline') {
    if (!traceId) return null;
    return (
      <>
        <DataPanel variant="inline" title={name} className={className}>
          {rows}
        </DataPanel>
        {dialogs}
      </>
    );
  }
  return (
    <>
      <DataPanel open={!!traceId} onClose={onClose} title={name} size={size} depth={depth} className={className}>
        {rows}
      </DataPanel>
      {dialogs}
    </>
  );
}
