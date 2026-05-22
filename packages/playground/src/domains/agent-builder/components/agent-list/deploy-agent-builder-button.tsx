import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui';
import { useState } from 'react';
import { ChannelDialog } from '@/domains/agent-builder/components/agent-edit/publish-channel-dialogs';
import { useStreamRunning } from '@/domains/agent-builder/contexts/stream-chat-context';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useChannelInstallations,
  useChannelPlatforms,
  useConnectChannelAction,
} from '@/domains/agents/hooks/use-channels';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { isAuthenticated } from '@/domains/auth/types';

export interface DeployAgentBuilderButtonProps {
  agentId: string;
}

/**
 * Admin-only "Deploy to Slack" entry point rendered in the agent builder
 * agent list. Targets the built-in `builder-agent`. Bypasses the
 * "add to library before connecting" gating that the Integrations card uses;
 * instead, an explicit confirmation dialog protects the action so it is
 * never one-click.
 */
export const DeployAgentBuilderButton = ({ agentId }: DeployAgentBuilderButtonProps) => {
  const { data: capabilities } = useAuthCapabilities();
  const { data: platforms = [] } = useChannelPlatforms();
  const slackPlatform = platforms.find(p => p.id === 'slack');
  const { data: installations = [] } = useChannelInstallations('slack', agentId);
  const activeInstallation = installations.find(i => i.status === 'active');
  const slackConnect = useConnectChannelAction('slack');
  const isRunning = useStreamRunning();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);

  const isAdmin =
    !!capabilities && isAuthenticated(capabilities) && (capabilities.access?.roles?.includes('admin') ?? false);

  if (!isAdmin) return null;
  if (!slackPlatform || !slackPlatform.isConfigured) return null;

  const hasInstallation = Boolean(activeInstallation);
  const title = hasInstallation ? 'Manage Slack deployment?' : 'Deploy this agent to Slack?';
  const description = hasInstallation
    ? 'Open the Slack deployment dialog to manage the existing installation for this agent.'
    : 'A Slack bot powered by this agent will be created. You will be redirected to Slack to authorize the installation.';
  const confirmLabel = hasInstallation ? 'Manage' : 'Deploy';

  const handleConfirm = () => {
    setConfirmOpen(false);
    if (hasInstallation) {
      setChannelDialogOpen(true);
    } else {
      slackConnect.connect(agentId);
    }
  };

  return (
    <>
      <Button
        variant="default"
        onClick={() => setConfirmOpen(true)}
        disabled={isRunning}
        data-testid="agent-builder-deploy-button"
        className="hidden lg:inline-flex shrink-0"
      >
        <PlatformIcon platform="slack" className="h-4 w-4" />
        Deploy to Slack
      </Button>

      <Dialog open={confirmOpen} onOpenChange={open => !open && setConfirmOpen(false)}>
        <DialogContent data-testid="agent-builder-deploy-confirm-dialog">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              data-testid="agent-builder-deploy-confirm-cancel"
            >
              Cancel
            </Button>
            <Button variant="default" onClick={handleConfirm} data-testid="agent-builder-deploy-confirm-confirm">
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ChannelDialog
        platform={slackPlatform}
        agentId={agentId}
        installation={activeInstallation}
        open={channelDialogOpen}
        onOpenChange={open => !open && setChannelDialogOpen(false)}
      />
    </>
  );
};
