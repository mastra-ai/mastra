import { Button, DropdownMenu } from '@mastra/playground-ui';
import { MoreVerticalIcon } from 'lucide-react';
import { DeleteAgentMenuItem } from './delete-agent-action';
import { VisibilityMenuItem } from './visibility-menu-item';

export interface AgentBuilderMobileMenuProps {
  /** Agent the publish actions apply to. */
  agentId?: string;
  /** When true, includes the Add/Remove from library item. Owner-only. */
  showSetVisibility?: boolean;
  /** When true, includes the destructive "Delete agent" item. Owner-only. */
  showDelete?: boolean;
  /** Required when showDelete is true — used in the confirm dialog copy. */
  agentName?: string;
  /** Disables all actions (e.g. during streaming). */
  disabled?: boolean;
}

export function AgentBuilderMobileMenu({
  agentId,
  showSetVisibility = false,
  showDelete = false,
  agentName,
  disabled = false,
}: AgentBuilderMobileMenuProps) {
  const canDelete = showDelete && Boolean(agentId) && Boolean(agentName);
  const canSetVisibility = showSetVisibility && Boolean(agentId);

  if (!canSetVisibility && !canDelete) return null;

  return (
    <div className="lg:hidden" data-testid="agent-builder-mobile-menu">
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button size="icon-sm" variant="ghost" tooltip="More actions" data-testid="agent-builder-mobile-menu-trigger">
            <MoreVerticalIcon />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {canSetVisibility && <VisibilityMenuItem agentId={agentId as string} disabled={disabled} />}
          {canDelete && (
            <>
              {canSetVisibility && <DropdownMenu.Separator />}
              <DeleteAgentMenuItem agentId={agentId as string} agentName={agentName as string} disabled={disabled} />
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
}
