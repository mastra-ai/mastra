import { Button } from '@mastra/playground-ui/components/Button';
import { TRACE_PROPERTY_FILTER_PARAM_BY_FIELD } from '@mastra/playground-ui/domains/traces/trace-filters';
import { ListTree } from 'lucide-react';

import { Link } from '@/lib/link';

export type ThreadTracesLinkProps = {
  threadId: string;
  /** The conversation's agent — its Traces tab is where the filtered list lives. */
  agentId: string;
};

/**
 * Opens the agent's Traces tab pre-filtered on the conversation being read, so the traces
 * behind the chat are one click away instead of a thread id typed into the filter by hand.
 */
export function ThreadTracesLink({ threadId, agentId }: ThreadTracesLinkProps) {
  const params = new URLSearchParams({ [TRACE_PROPERTY_FILTER_PARAM_BY_FIELD.threadId]: threadId });
  const href = `/agents/${encodeURIComponent(agentId)}/traces?${params.toString()}`;

  return (
    // Icon-only, sized like the share button it sits next to in the header.
    <Button as={Link} href={href} tooltip="Thread traces">
      <ListTree className="text-neutral3 hover:text-neutral6 h-4 w-4" />
    </Button>
  );
}
