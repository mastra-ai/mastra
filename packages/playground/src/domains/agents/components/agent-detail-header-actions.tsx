import { Button } from '@mastra/playground-ui/components/Button';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Check, Link as LinkIcon } from 'lucide-react';

import { AgentConfigToggle } from './agent-config-toggle';
import { RouteHeaderActions } from '@/lib/route-header';
import { withStudioBasePath } from '@/lib/studio-base-path';

export interface AgentDetailHeaderActionsProps {
  agentId: string;
}

/** Share / Config actions shown in the route header on every agent sub-page. */
export function AgentDetailHeaderActions({ agentId }: AgentDetailHeaderActionsProps) {
  const sessionUrl = `${window.location.origin}${withStudioBasePath(`/agents/${encodeURIComponent(agentId)}/session`)}`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });

  return (
    <RouteHeaderActions owner="agent-detail">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label="Copy session URL"
          onClick={handleShareLink}
          tooltip="Copy session URL to share with your team"
          data-testid="agent-entity-header-share"
        >
          {isShareCopied ? <Check /> : <LinkIcon />}
        </Button>
        <AgentConfigToggle />
      </div>
    </RouteHeaderActions>
  );
}
