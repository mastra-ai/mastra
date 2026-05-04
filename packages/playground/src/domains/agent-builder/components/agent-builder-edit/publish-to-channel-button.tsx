import { Button, DropdownMenu, StatusBadge } from '@mastra/playground-ui';
import { ChevronDownIcon } from 'lucide-react';
import { useState } from 'react';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useChannelInstallations,
  useChannelPlatforms,
  type ChannelInstallationInfo,
  type ChannelPlatformInfo,
} from '@/domains/agents/hooks/use-channels';
import { getPublishChannelDialog } from './publish-channel-dialogs';

export interface PublishToChannelButtonProps {
  agentId: string | undefined;
  disabled?: boolean;
}

export function PublishToChannelButton({ agentId, disabled = false }: PublishToChannelButtonProps) {
  const { data: platforms = [], isLoading } = useChannelPlatforms();
  const [active, setActive] = useState<{ platform: ChannelPlatformInfo; installation?: ChannelInstallationInfo } | null>(
    null,
  );

  if (!agentId || isLoading || platforms.length === 0) {
    return null;
  }

  const ActiveDialog = active ? getPublishChannelDialog(active.platform.id) : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            data-testid="agent-builder-publish-channel"
          >
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

      {ActiveDialog && active ? (
        <ActiveDialog
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
  const installation = installations.find(i => i.status === 'active') ?? installations[0];

  return (
    <DropdownMenu.Item
      data-testid={`agent-builder-publish-channel-item-${platform.id}`}
      onSelect={event => {
        event.preventDefault();
        onSelect(installation);
      }}
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
