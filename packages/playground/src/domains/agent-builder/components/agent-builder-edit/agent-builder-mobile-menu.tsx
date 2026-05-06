import { Button, DropdownMenu, StatusBadge } from '@mastra/playground-ui';
import { Globe, LockIcon, MoreVerticalIcon } from 'lucide-react';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../schemas';
import { DeleteAgentMenuItem } from './delete-agent-action';
import { ChannelDialog } from './publish-channel-dialogs';
import { useVisibilityChange } from './use-visibility-change';
import type { Visibility } from './visibility-select';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useChannelInstallations,
  useChannelPlatforms,
  useConnectChannelAction,
} from '@/domains/agents/hooks/use-channels';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface AgentBuilderMobileMenuProps {
  /** Agent the publish actions apply to. */
  agentId?: string;
  /** When true, includes the Add/Remove from library item. Owner-only. */
  showSetVisibility?: boolean;
  /** When true, includes the per-channel publish items. */
  showPublishToChannel?: boolean;
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
  showPublishToChannel = true,
  showDelete = false,
  agentName,
  disabled = false,
}: AgentBuilderMobileMenuProps) {
  const [activeChannel, setActiveChannel] = useState<{
    platform: ChannelPlatformInfo;
    installation?: ChannelInstallationInfo;
  } | null>(null);

  const canPublishToChannel = showPublishToChannel && Boolean(agentId);
  const { data: platforms = [] } = useChannelPlatforms();
  const platformsToShow = canPublishToChannel ? platforms : [];
  const canDelete = showDelete && Boolean(agentId) && Boolean(agentName);
  const canSetVisibility = showSetVisibility && Boolean(agentId);

  if (!canSetVisibility && !canDelete && (!canPublishToChannel || platformsToShow.length === 0)) return null;

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
          {canPublishToChannel && platformsToShow.length > 0 && (
            <>
              {canSetVisibility && <DropdownMenu.Separator />}
              <DropdownMenu.Label>Publish to…</DropdownMenu.Label>
              {platformsToShow.map(platform => (
                <MobileMenuChannelItem
                  key={platform.id}
                  platform={platform}
                  agentId={agentId as string}
                  disabled={disabled}
                  onSelect={installation => setActiveChannel({ platform, installation })}
                />
              ))}
            </>
          )}
          {canDelete && (
            <>
              {(canSetVisibility || (canPublishToChannel && platformsToShow.length > 0)) && (
                <DropdownMenu.Separator />
              )}
              <DeleteAgentMenuItem agentId={agentId as string} agentName={agentName as string} disabled={disabled} />
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu>

      {activeChannel && agentId ? (
        <ChannelDialog
          platform={activeChannel.platform}
          agentId={agentId}
          installation={activeChannel.installation}
          open
          onOpenChange={open => {
            if (!open) setActiveChannel(null);
          }}
        />
      ) : null}
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
          onSelect={event => {
            event.preventDefault();
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
          onSelect={event => {
            event.preventDefault();
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

interface MobileMenuChannelItemProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  disabled: boolean;
  onSelect: (installation: ChannelInstallationInfo | undefined) => void;
}

function MobileMenuChannelItem({ platform, agentId, disabled, onSelect }: MobileMenuChannelItemProps) {
  const { data: installations = [] } = useChannelInstallations(platform.id, agentId);
  const installation = installations.find(i => i.status === 'active');
  const { connect, isConnecting } = useConnectChannelAction(platform.id);

  // Slack-specific shortcut: when the platform is configured but not yet
  // connected, the dialog adds nothing — the user's intent ("connect Slack")
  // is unambiguous from the menu item itself, so kick off the OAuth flow
  // directly instead of opening the dialog.
  const shouldDirectConnect = platform.id === 'slack' && platform.isConfigured && !installation;

  const handleSelect = (event: Event) => {
    event.preventDefault();

    if (!shouldDirectConnect) {
      onSelect(installation);
      return;
    }

    connect(agentId);
  };

  return (
    <DropdownMenu.Item
      data-testid={`agent-builder-mobile-menu-publish-channel-${platform.id}`}
      disabled={disabled || isConnecting}
      onSelect={handleSelect}
    >
      <PlatformIcon platform={platform.id} className="h-4 w-4" />
      <span className="flex-1">{platform.name}</span>
      {!platform.isConfigured ? (
        <StatusBadge variant="warning" size="sm">
          Not configured
        </StatusBadge>
      ) : installation ? (
        <StatusBadge variant="success" size="sm">
          Connected
        </StatusBadge>
      ) : null}
    </DropdownMenu.Item>
  );
}
