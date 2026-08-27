import { Button } from '@mastra/playground-ui/components/Button';
import { startTransition } from 'react';

import { useLinkComponent } from '@/lib/framework';

export type PartialThreadHeaderProps = {
  threadId: string;
};

/**
 * Marks the panel's thread pane as a single turn and offers the whole thread. Navigation goes
 * through `startTransition` so the framework's view transition can play instead of snapping.
 */
export function PartialThreadHeader({ threadId }: PartialThreadHeaderProps) {
  const { navigate } = useLinkComponent();
  const href = `/traces/investigate?${new URLSearchParams({ threadId })}`;

  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <span className="text-neutral4 text-ui-sm">Partial thread</span>
      <Button variant="ghost" size="sm" onClick={() => startTransition(() => navigate(href))}>
        See full thread
      </Button>
    </div>
  );
}
