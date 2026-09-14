import { Button } from '@mastra/playground-ui/components/Button';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { PanelEdgeIcon } from '@mastra/playground-ui/resize/panel-edge-icon';
import { Check, Link as LinkIcon, Pencil } from 'lucide-react';

import { useAgent } from '../hooks/use-agent';
import { OVERVIEW_PANEL_SHORTCUT } from './overview-panel-shortcuts';
import { useCanCreateAgent } from '@/domains/agent-builder/hooks/use-can-create-agent';
import { useLinkComponent } from '@/lib/framework';
import { RouteHeaderActions } from '@/lib/route-header';
import { useRouteSidePanel } from '@/lib/route-side-panel';
import { withStudioBasePath } from '@/lib/studio-base-path';

export interface AgentDetailHeaderActionsProps {
  agentId: string;
}

/** Edit / Share / Config-panel toggle shown in the route header on every agent sub-page. */
export function AgentDetailHeaderActions({ agentId }: AgentDetailHeaderActionsProps) {
  const { data: agent } = useAgent(agentId);
  const { canCreateAgent } = useCanCreateAgent();
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const { isCollapsed, toggle } = useRouteSidePanel();

  const sessionUrl = `${window.location.origin}${withStudioBasePath(`/agents/${encodeURIComponent(agentId)}/session`)}`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });

  const editPath = paths.cmsAgentEditLink(agentId);
  const showEditButton = canCreateAgent && agent?.source === 'stored' && Boolean(editPath);

  return (
    <RouteHeaderActions owner="agent-detail">
      <div className="flex items-center gap-2">
        {showEditButton && (
          <Button variant="outline" size="sm" as={FrameworkLink} to={editPath} icon={<Pencil />}>
            Edit
          </Button>
        )}
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
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          className="max-lg:hidden"
          aria-label="Toggle agent config panel"
          aria-pressed={!isCollapsed}
          tooltip={
            <span className="inline-flex items-center gap-1.5">
              {isCollapsed ? 'Show config panel' : 'Hide config panel'}
              <Kbd size="xs">{OVERVIEW_PANEL_SHORTCUT}</Kbd>
            </span>
          }
          data-testid="agent-overview-panel-toggle"
          onClick={toggle}
        >
          <PanelEdgeIcon side="right" />
        </Button>
      </div>
    </RouteHeaderActions>
  );
}
