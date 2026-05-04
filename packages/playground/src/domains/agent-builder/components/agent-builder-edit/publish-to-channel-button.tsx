import { Button, DropdownMenu, StatusBadge, toast } from '@mastra/playground-ui';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { ChannelDialog } from './publish-channel-dialogs';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useChannelInstallations,
  useChannelPlatforms,
  useConnectChannel,
} from '@/domains/agents/hooks/use-channels';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface PublishToChannelButtonProps {
  agentId: string | undefined;
  disabled?: boolean;
}

type ChannelTarget = { platform: ChannelPlatformInfo; installation?: ChannelInstallationInfo };

export function PublishToChannelButton({ agentId, disabled = false }: PublishToChannelButtonProps) {
  const { data: platforms = [], isLoading } = useChannelPlatforms();
  const [active, setActive] = useState<ChannelTarget | null>(null);

  if (!agentId || isLoading || platforms.length === 0) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button size="sm" variant="ghost" disabled={disabled} data-testid="agent-builder-publish-channel">
            Publish to…
            <ChevronDownIcon className="h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end">
          {platforms.map(platform => (
            <PublishChannelMenuItem
              key={platform.id}
              platform={platform}
              agentId={agentId}
              onSelect={installation => setActive({ platform, installation })}
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu>

      {active ? (
        <ChannelDialog
          platform={active.platform}
          agentId={agentId}
          installation={active.installation}
          open
          onOpenChange={open => {
            if (!open) setActive(null);
          }}
        />
      ) : null}
    </>
  );
}

interface PublishChannelMenuItemProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  onSelect: (installation: ChannelInstallationInfo | undefined) => void;
}

function PublishChannelMenuItem({ platform, agentId, onSelect }: PublishChannelMenuItemProps) {
  const { data: installations = [] } = useChannelInstallations(platform.id, agentId);
  const installation = installations.find(i => i.status === 'active');
  const { mutate: connect, isPending: isConnecting } = useConnectChannel(platform.id);

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

    connect(
      { agentId },
      {
        onSuccess: result => {
          if (result.type === 'oauth') {
            window.location.href = result.authorizationUrl;
            return;
          }
          if (result.type === 'deep_link') {
            const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
            if (!popup) {
              toast.error('Popup blocked — please allow popups and try again');
            }
          }
          // 'immediate' → installation list will be invalidated by the hook;
          // no further UI action needed.
        },
        onError: (err: Error & { body?: { error?: string } }) => {
          toast.error(err.body?.error || err.message || 'Failed to connect channel');
        },
      },
    );
  };

  return (
    <DropdownMenu.Item
      data-testid={`agent-builder-publish-channel-item-${platform.id}`}
      disabled={isConnecting}
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
