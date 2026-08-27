import { Button } from '@mastra/playground-ui/components/Button';
import { Maximize2 } from 'lucide-react';
import { startTransition } from 'react';

import { useLinkComponent } from '@/lib/framework';

export type FullThreadLinkProps = {
  threadId: string;
};

/**
 * Escape hatch out of the panel's single-turn view. It lives inside the "Partial thread" tab,
 * so it renders as a span (a button can't nest in the tab's button) and stops the click from
 * reaching the tab. Navigation goes through `startTransition` for the view transition.
 */
export function FullThreadLink({ threadId }: FullThreadLinkProps) {
  const { navigate } = useLinkComponent();
  const href = `/traces/investigate?${new URLSearchParams({ threadId })}`;

  const open = () => startTransition(() => navigate(href));

  return (
    <Button
      as="span"
      role="button"
      tabIndex={0}
      size="icon-sm"
      tooltip="See full thread"
      aria-label="See full thread"
      onClick={event => {
        event.stopPropagation();
        open();
      }}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        open();
      }}
    >
      <Maximize2 />
    </Button>
  );
}
