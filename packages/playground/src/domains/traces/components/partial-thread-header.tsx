import { Button } from '@mastra/playground-ui/components/Button';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { startTransition } from 'react';

import { useLinkComponent } from '@/lib/framework';

export type PartialThreadHeaderProps = {
  threadId: string;
};

/**
 * Marks the pane as a single turn and offers the whole thread. Wears the trace panel's header
 * chrome, since the two sit side by side in one card and should read as one surface. Navigation
 * goes through `startTransition` so the framework's view transition can play instead of snapping.
 */
export function PartialThreadHeader({ threadId }: PartialThreadHeaderProps) {
  const { navigate } = useLinkComponent();
  const href = `/traces/investigate?${new URLSearchParams({ threadId })}`;

  return (
    <DataPanel.Header>
      <DataPanel.Heading>
        Partial <b>thread</b>
      </DataPanel.Heading>
      <Button size="md" className="ml-auto shrink-0" onClick={() => startTransition(() => navigate(href))}>
        See full thread
      </Button>
    </DataPanel.Header>
  );
}
