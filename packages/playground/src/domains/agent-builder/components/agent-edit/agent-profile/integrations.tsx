import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEditPage } from '@/domains/agent-builder/contexts/edit-page-context';
import { usePublishAndConnectChannel } from '@/domains/agent-builder/hooks/use-publish-and-connect-channel';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import { useChannelInstallations, useChannelPlatforms } from '@/domains/agents/hooks/use-channels';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface IntegrationsProps {
  agentId: string;
  editable?: boolean;
}

const PLATFORM_DESCRIPTION: Record<string, string> = {
  slack: 'Creates a Slack bot powered by this agent.',
};

export const Integrations = ({ agentId, editable = true }: IntegrationsProps) => {
  const { data: platforms = [], isLoading } = useChannelPlatforms();
  const { canPublishToChannel } = useEditPage();
  const { requestPublishAndConnect, dialog, channelDialog } = usePublishAndConnectChannel(agentId);

  if (isLoading) {
    return (
      <div className="flex justify-center px-6 py-8" data-testid="integrations-detail-picker-loading">
        <div className="flex w-full max-w-[48rem] flex-col items-center gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>

          <div className="flex flex-wrap items-stretch justify-center gap-4">
            <div className="border-border1 bg-surface3 flex w-48 flex-col items-center gap-3 rounded-xl border px-4 py-6">
              <Skeleton className="size-14 rounded-xl" />
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-badge-default w-20 rounded-full" />
            </div>
            <div className="border-border1 bg-surface3 flex w-48 flex-col items-center gap-3 rounded-xl border px-4 py-6">
              <Skeleton className="size-14 rounded-xl" />
              <div className="flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-badge-default w-20 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (platforms.length === 0) {
    return (
      <div className="flex justify-center px-6 py-8" data-testid="integrations-detail-picker">
        <Txt variant="ui-md" className="text-neutral3">
          No integrations configured for this project
        </Txt>
      </div>
    );
  }

  return (
    <div className="flex justify-center px-6 py-8" data-testid="integrations-detail-picker">
      <div className="flex w-full max-w-[48rem] flex-col items-center gap-6 text-center">
        <div className="flex flex-col gap-2">
          <Txt variant="header-sm" className="text-neutral6 font-semibold">
            Channel integrations
          </Txt>
          <Txt variant="ui-md" className="text-neutral3">
            Publish this agent to external platforms. Each connection installs a bot in the platform that runs this
            agent.
          </Txt>
        </div>

        <div className="flex flex-wrap items-stretch justify-center gap-4">
          {platforms.map(platform => (
            <IntegrationCard
              key={platform.id}
              platform={platform}
              agentId={agentId}
              disabled={!editable}
              requiresLibrary={!canPublishToChannel}
              onSelect={installation => requestPublishAndConnect(platform, installation)}
            />
          ))}
        </div>
      </div>

      {dialog}
      {channelDialog}
    </div>
  );
};

interface IntegrationCardProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  disabled: boolean;
  requiresLibrary: boolean;
  onSelect: (installation: ChannelInstallationInfo | undefined) => void;
}

const IntegrationCard = ({ platform, agentId, disabled, requiresLibrary, onSelect }: IntegrationCardProps) => {
  const { data: installations = [] } = useChannelInstallations(platform.id, agentId);
  const installation = installations.find(i => i.status === 'active');

  const description = PLATFORM_DESCRIPTION[platform.id];

  // When the platform itself isn't configured at the project level, the
  // library-publication requirement is moot — the platform-level blocker is
  // more fundamental and we surface that badge alone.
  const showLibraryBadge = platform.isConfigured && requiresLibrary;

  return (
    <button
      type="button"
      onClick={() => onSelect(installation)}
      disabled={disabled}
      data-testid={`integration-card-${platform.id}`}
      className="border-border1 bg-surface3 hover:bg-surface4 focus-visible:ring-accent1 flex w-48 flex-col items-center gap-3 rounded-xl border px-4 py-6 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="bg-surface4 grid size-14 place-items-center rounded-xl">
        <PlatformIcon platform={platform.id} className="h-7 w-7" />
      </div>

      <div className="flex flex-col items-center gap-1">
        <Txt variant="ui-md" className="text-neutral6 font-semibold">
          {platform.name}
        </Txt>
        {description ? (
          <Txt variant="ui-xs" className="text-neutral3">
            {description}
          </Txt>
        ) : null}
      </div>

      {!platform.isConfigured ? (
        <StatusBadge variant="warning" size="sm" withDot>
          Not configured
        </StatusBadge>
      ) : installation ? (
        <StatusBadge variant="success" size="sm" withDot>
          Connected
        </StatusBadge>
      ) : (
        <StatusBadge variant="neutral" size="sm" withDot>
          Not connected
        </StatusBadge>
      )}

      {showLibraryBadge ? (
        <StatusBadge variant="warning" size="sm" withDot>
          Add to library to connect
        </StatusBadge>
      ) : null}
    </button>
  );
};
