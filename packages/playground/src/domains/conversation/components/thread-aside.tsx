import { Card } from '@mastra/playground-ui/components/Card';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import type { ReactNode } from 'react';

/**
 * Elevated side container for the thread page. Sits next to the conversation and
 * hosts thread-scoped content (traces today, more later).
 */
export function ThreadAside({
  title,
  onClose,
  children,
}: {
  title?: ReactNode;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <Card
      as="aside"
      appearance="surface"
      elevation="elevated"
      // Nested inside the studio frame (1.5rem radius, 0.5rem inset) → nested radius is 1rem.
      className="border-border1 flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border"
    >
      {title ? (
        // Same header anatomy as the trace/span DataPanels so the aside lines up
        // with the trace panel that replaces the list when a trace is opened.
        <DataPanel.Header>
          <DataPanel.Heading>{title}</DataPanel.Heading>
          {onClose ? <DataPanel.CloseButton onClick={onClose} /> : null}
        </DataPanel.Header>
      ) : null}
      <div className="min-h-0 flex-1">{children}</div>
    </Card>
  );
}
