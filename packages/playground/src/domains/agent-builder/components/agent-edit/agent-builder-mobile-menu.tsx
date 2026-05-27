import { Button, DropdownMenu } from '@mastra/playground-ui';
import { Globe, LockIcon, MoreVerticalIcon } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { useVisibilityChange } from '../../hooks/use-visibility-change-agent';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { DeleteAgentMenuItem } from './delete-agent-action';
import type { Visibility } from './visibility-select';

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

interface VisibilityMenuItemProps {
  agentId: string;
  disabled: boolean;
}

function VisibilityMenuItem({ agentId, disabled }: VisibilityMenuItemProps) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const value = (useWatch({ control: formMethods.control, name: 'visibility' }) ?? 'private') as Visibility;
  const { requestChange, dialog } = useVisibilityChange(agentId);

  return (
    <>
      {value === 'private' ? (
        <DropdownMenu.Item
          data-testid="agent-builder-mobile-menu-visibility-add"
          disabled={disabled}
          closeOnClick={false}
          onSelect={() => {
            requestChange('public');
          }}
        >
          <Globe />
          <span>Add to library</span>
        </DropdownMenu.Item>
      ) : (
        <DropdownMenu.Item
          data-testid="agent-builder-mobile-menu-visibility-remove"
          disabled={disabled}
          closeOnClick={false}
          onSelect={() => {
            requestChange('private');
          }}
        >
          <LockIcon />
          <span>Remove from library</span>
        </DropdownMenu.Item>
      )}
      {dialog}
    </>
  );
}
