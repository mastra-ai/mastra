import { StatusBadge, Txt } from '@mastra/playground-ui';
import { useState } from 'react';
import { ChannelDialog } from '../publish-channel-dialogs';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useChannelInstallations,
  useChannelPlatforms,
  useConnectChannelAction,
} from '@/domains/agents/hooks/use-channels';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface IntegrationsProps {
  agentId: string;
  editable?: boolean;
}

type ChannelTarget = { platform: ChannelPlatformInfo; installation?: ChannelInstallationInfo };

export const Integrations = ({ agentId, editable = true }: IntegrationsProps) => {
  const { data: platforms = [], isLoading } = useChannelPlatforms();
  const [active, setActive] = useState<ChannelTarget | null>(null);

  if (isLoading) return null;

  if (platforms.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-6" data-testid="integrations-detail-picker">
        <Txt variant="ui-md" className="text-neutral3">
          No integrations configured for this project
        </Txt>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 gap-2 px-6 overflow-y-auto" data-testid="integrations-detail-picker">
      {platforms.map(platform => (
        <IntegrationRow
          key={platform.id}
          platform={platform}
          agentId={agentId}
          disabled={!editable}
          onOpenDialog={installation => setActive({ platform, installation })}
        />
      ))}

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
    </div>
  );
};

interface IntegrationRowProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  disabled: boolean;
  onOpenDialog: (installation: ChannelInstallationInfo | undefined) => void;
}

const IntegrationRow = ({ platform, agentId, disabled, onOpenDialog }: IntegrationRowProps) => {
  const { data: installations = [] } = useChannelInstallations(platform.id, agentId);
  const installation = installations.find(i => i.status === 'active');
  const { connect, isConnecting } = useConnectChannelAction(platform.id);

  // Mirror PublishToChannelButton: when Slack is configured but not yet
  // connected, the row click kicks off OAuth directly instead of opening
  // the dialog.
  const shouldDirectConnect = platform.id === 'slack' && platform.isConfigured && !installation;

  const handleClick = () => {
    if (!shouldDirectConnect) {
      onOpenDialog(installation);
      return;
    }
    connect(agentId);
  };

  const isDisabled = disabled || isConnecting;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      data-testid={`integration-row-${platform.id}`}
      className="flex items-center gap-3 rounded-lg border border-border1 bg-surface3 p-4 text-left transition-colors hover:bg-surface4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent1 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <PlatformIcon platform={platform.id} className="h-5 w-5" />
      <Txt variant="ui-md" className="flex-1 font-medium text-neutral6">
        {platform.name}
      </Txt>
      {!platform.isConfigured ? (
        <StatusBadge variant="warning" size="sm">
          Not configured
        </StatusBadge>
      ) : installation ? (
        <StatusBadge variant="success" size="sm">
          Connected
        </StatusBadge>
      ) : null}
    </button>
  );
};
