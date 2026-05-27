import {
  Button,
  DialogBody,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Txt,
} from '@mastra/playground-ui';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import { useConnectChannelAction } from '@/domains/agents/hooks/use-channels';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

interface PlatformCopy {
  description: (platformName: string) => string;
  notConfigured: (platformName: string) => string;
  notConnected: (platformName: string) => string;
  connectLabel: string;
  /** When true, only installations with status === 'active' count as connected. */
  requireActiveInstallation?: boolean;
}

const DEFAULT_COPY: PlatformCopy = {
  description: name => `Manage the ${name} connection for this agent.`,
  notConfigured: () => 'This platform is not configured on the server.',
  notConnected: name => `Publish this agent to ${name}.`,
  connectLabel: 'Connect',
};

const PLATFORM_COPY: Record<string, Partial<PlatformCopy>> = {
  slack: {
    description: () => 'Manage the Slack connection for this agent.',
    notConfigured: () => 'Slack is not configured on the server.',
    notConnected: () => 'You will be redirected to Slack to choose a workspace and approve permissions.',
    connectLabel: 'Continue with Slack',
    requireActiveInstallation: true,
  },
};

function copyFor(platformId: string): PlatformCopy {
  return { ...DEFAULT_COPY, ...(PLATFORM_COPY[platformId] ?? {}) };
}

export interface PublishChannelContentProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  installation?: ChannelInstallationInfo;
  onClose: () => void;
  onDisconnectRequest: () => void;
}

export function PublishChannelContent({
  platform,
  agentId,
  installation,
  onClose,
  onDisconnectRequest,
}: PublishChannelContentProps) {
  const { connect, isConnecting } = useConnectChannelAction(platform.id, { onClose });
  const copy = copyFor(platform.id);
  const activeInstallation =
    copy.requireActiveInstallation && installation?.status !== 'active' ? undefined : installation;

  const handleConnect = () => {
    connect(agentId);
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <PlatformIcon platform={platform.id} className="h-8 w-8 shrink-0" />
          <DialogTitle>{platform.name} integration</DialogTitle>
        </div>

        <DialogDescription>{copy.description(platform.name)}</DialogDescription>
      </DialogHeader>

      <DialogBody>
        <Txt variant="ui-sm" className="text-neutral3">
          {!platform.isConfigured ? (
            copy.notConfigured(platform.name)
          ) : activeInstallation ? (
            <>
              Connected <span className="text-neutral6">{platform.name}</span> to{' '}
              <span className="text-neutral6">Mastra</span>
            </>
          ) : (
            copy.notConnected(platform.name)
          )}
        </Txt>
      </DialogBody>

      <DialogFooter>
        {platform.isConfigured && activeInstallation ? (
          <Button
            variant="default"
            onClick={onDisconnectRequest}
            data-testid={`publish-channel-dialog-${platform.id}-disconnect`}
          >
            Disconnect
          </Button>
        ) : platform.isConfigured ? (
          <Button
            variant="default"
            onClick={handleConnect}
            disabled={isConnecting}
            data-testid={`publish-channel-dialog-${platform.id}-connect`}
          >
            {isConnecting ? 'Connecting…' : copy.connectLabel}
          </Button>
        ) : (
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
