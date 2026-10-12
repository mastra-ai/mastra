import type { GetAgentResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { Pin, PinOff } from 'lucide-react';

export function PinnableAgentLink({
  agent,
  url,
  isActive,
  pinned,
  onTogglePin,
}: {
  agent: GetAgentResponse;
  url: string;
  isActive: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const actionLabel = pinned ? `Unpin ${agent.name}` : `Pin ${agent.name}`;
  return (
    <Sidebar.NavLink
      state="default"
      link={{ name: agent.name, url, icon: <AgentIcon /> }}
      isActive={isActive}
      action={
        <Button variant="ghost" size="icon-sm" aria-label={actionLabel} title={actionLabel} onClick={onTogglePin}>
          {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </Button>
      }
    />
  );
}
