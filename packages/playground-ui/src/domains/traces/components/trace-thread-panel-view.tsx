import type { ReactNode } from 'react';

import { DataPanel } from '@/ds/components/DataPanel';

export interface TraceThreadPanelViewProps {
  /** Keep the panel mounted and toggle `open` so the drawer animates in and out. */
  open: boolean;
  threadId: string;
  /** Close the thread drawer, revealing the trace panel underneath. */
  onClose: () => void;
  /** The drawer takes the full frame while a span detail is open in the thread; otherwise it opens wide. */
  hasSelectedSpan?: boolean;
  /** Sibling-drawer elevation (see `DataPanel`); defaults to 2, above the trace panel. */
  depth?: 1 | 2 | 3;
  /** Accessible drawer name; defaults to the thread id. */
  title?: string;
  /** Close button label; defaults to "Back to trace" for the stacked drawer. */
  closeLabel?: string;
  /** The thread itself, typically a `ThreadViewByTraceView` fed by the host. */
  children?: ReactNode;
}

/** The drawer that frames a full thread, stacked above the trace panel. Draws what the host hands it. */
export function TraceThreadPanelView({
  open,
  threadId,
  onClose,
  hasSelectedSpan = false,
  depth = 2,
  title,
  closeLabel = 'Back to trace',
  children,
}: TraceThreadPanelViewProps) {
  return (
    <DataPanel
      open={open}
      onClose={onClose}
      title={title ?? `Thread ${threadId}`}
      depth={depth}
      size={hasSelectedSpan ? 'full' : 'wide'}
    >
      <DataPanel.Header>
        <DataPanel.CloseButton onClick={onClose} label={closeLabel} tooltip={closeLabel} />
        <DataPanel.HeaderContent>
          <DataPanel.Heading>
            Thread
            <DataPanel.CopyId id={threadId} />
          </DataPanel.Heading>
        </DataPanel.HeaderContent>
      </DataPanel.Header>
      <div className="min-h-0 flex-1">{children}</div>
    </DataPanel>
  );
}
