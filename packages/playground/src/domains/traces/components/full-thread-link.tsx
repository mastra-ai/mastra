import { Button } from '@mastra/playground-ui/components/Button';
import { Maximize2 } from 'lucide-react';
import { startTransition } from 'react';

import { useLinkComponent } from '@/lib/framework';

export type FullThreadLinkProps = {
  threadId: string;
  /** The conversation's agent — the enriched reading lives on its chat page. */
  agentId: string;
};

/**
 * Escape hatch out of the panel's single-turn view: it opens the agent's chat already in
 * enriched mode, where the whole thread is rebuilt from its traces. It lives inside the
 * "Partial thread" tab,
 * so it renders as a span (a button can't nest in the tab's button) and stops the click from
 * reaching the tab. Navigation goes through `startTransition` for the view transition.
 */
export function FullThreadLink({ threadId, agentId }: FullThreadLinkProps) {
  const { navigate } = useLinkComponent();
  const href = `/agents/${encodeURIComponent(agentId)}/chat/${encodeURIComponent(threadId)}?enriched=true`;

  const open = () => startTransition(() => navigate(href));

  return (
    <Button
      as="span"
      role="button"
      tabIndex={0}
      size="icon-xs"
      variant="ghost"
      // Sized down to the label's line box so it adds no height to the tab band.
      className="h-4 w-4 [&>svg]:size-3"
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
