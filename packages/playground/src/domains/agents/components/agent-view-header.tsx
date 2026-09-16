import { Button } from '@mastra/playground-ui/components/Button';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Check, Link as LinkIcon, SlidersHorizontal, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';

import { AgentEntityHeader } from './agent-entity-header';
import { withStudioBasePath } from '@/lib/studio-base-path';

export interface AgentViewHeaderProps {
  agentId: string;
  view: 'chat' | 'settings';
}

export function AgentViewHeader({ agentId, view }: AgentViewHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const sessionUrl = `${window.location.origin}${withStudioBasePath(`/agents/${encodeURIComponent(agentId)}/session`)}`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });

  const handleToggle = () => {
    if (view === 'chat') {
      void navigate(`/agents/${agentId}/settings`, {
        state: { from: `${location.pathname}${location.search}` },
        viewTransition: true,
      });
      return;
    }

    const from = (location.state as { from?: string } | null)?.from;
    void navigate(from ?? `/agents/${agentId}/chat/new`, { viewTransition: true });
  };

  return (
    <TooltipProvider>
      <div
        className="flex items-center justify-between gap-2 pr-3 max-lg:py-2"
        style={{ viewTransitionName: 'agent-view-header' }}
      >
        <div className="min-w-0 flex-1 max-lg:hidden">
          <AgentEntityHeader agentId={agentId} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button
            variant="default"
            type="button"
            onClick={handleShareLink}
            tooltip="Copy session URL to share with your team"
            data-testid="agent-entity-header-share"
          >
            {isShareCopied ? (
              <Check className="text-neutral3 h-4 w-4" />
            ) : (
              <LinkIcon className="text-neutral3 hover:text-neutral6 h-4 w-4" />
            )}
          </Button>
          <Button variant="default" type="button" onClick={handleToggle} data-testid="agent-view-header-toggle">
            {view === 'chat' ? (
              <>
                <SlidersHorizontal className="text-neutral3 h-4 w-4" /> Settings
              </>
            ) : (
              <>
                <X className="text-neutral3 h-4 w-4" /> Close
              </>
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
