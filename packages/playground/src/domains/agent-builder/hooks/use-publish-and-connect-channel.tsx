import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@mastra/playground-ui';
import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChannelDialog } from '../components/agent-edit/publish-channel-dialogs';
import { useEditPage } from '../contexts/edit-page-context';
import type { AgentBuilderEditFormValues } from '../schemas';
import { useConnectChannelAction } from '@/domains/agents/hooks/use-channels';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';

interface PendingRequest {
  platform: ChannelPlatformInfo;
  installation?: ChannelInstallationInfo;
}

export interface UsePublishAndConnectChannelResult {
  /**
   * Request to connect the given channel. If the agent is not yet published
   * to the library, the user is prompted to add it first. Otherwise, the
   * original branching is applied immediately (direct OAuth for configured-
   * but-not-installed Slack, channel dialog otherwise).
   */
  requestPublishAndConnect: (platform: ChannelPlatformInfo, installation?: ChannelInstallationInfo) => void;
  /** Confirm dialog rendered when the agent must be added to the library first. */
  dialog: ReactNode;
  /** Channel dialog rendered for non-Slack-direct flows. */
  channelDialog: ReactNode;
}

/**
 * Centralises the "publish-then-connect" gating for channel integrations.
 *
 * The Integrations tab in the agent profile uses this hook to ensure that
 * connecting an agent to a channel (e.g. Slack) first publishes the agent to
 * the library — required so teammates can actually use the resulting bot.
 *
 * Mirrors the shape of `useVisibilityChange` (returns `{ requestX, dialog }`
 * plus an extra `channelDialog` for the follow-up channel UI).
 */
export function usePublishAndConnectChannel(agentId: string): UsePublishAndConnectChannelResult {
  const { canPublishToChannel } = useEditPage();
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const { updateStoredAgent } = useStoredAgentMutations(agentId);

  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeChannelDialog, setActiveChannelDialog] = useState<PendingRequest | null>(null);

  // Per-platform connect action is needed before we know which platform was
  // clicked, so we instantiate the Slack one here (currently the only
  // platform with a direct-connect shortcut). When more platforms gain
  // shortcuts, this lookup can be expanded.
  const slackConnect = useConnectChannelAction('slack');

  const runChannelAction = useCallback(
    (request: PendingRequest) => {
      const { platform, installation } = request;
      const shouldDirectConnect = platform.id === 'slack' && platform.isConfigured && !installation;
      if (shouldDirectConnect) {
        slackConnect.connect(agentId);
        return;
      }
      setActiveChannelDialog(request);
    },
    [agentId, slackConnect],
  );

  const requestPublishAndConnect = useCallback(
    (platform: ChannelPlatformInfo, installation?: ChannelInstallationInfo) => {
      const request: PendingRequest = { platform, installation };
      if (canPublishToChannel) {
        runChannelAction(request);
        return;
      }
      setPendingRequest(request);
      setConfirmOpen(true);
    },
    [canPublishToChannel, runChannelAction],
  );

  const handleCancel = useCallback(() => {
    setConfirmOpen(false);
    setPendingRequest(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!pendingRequest) return;
    try {
      await updateStoredAgent.mutateAsync({ visibility: 'public' });
      formMethods.setValue('visibility', 'public', { shouldDirty: false });
      toast.success('Agent added to the library');
      const request = pendingRequest;
      setConfirmOpen(false);
      setPendingRequest(null);
      runChannelAction(request);
    } catch (error) {
      toast.error(`Failed to add to library: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [pendingRequest, updateStoredAgent, formMethods, runChannelAction]);

  const platformName = pendingRequest?.platform.name ?? 'this channel';

  const dialog = useMemo(
    () => (
      <Dialog open={confirmOpen} onOpenChange={open => !open && handleCancel()}>
        <DialogContent data-testid="agent-builder-publish-before-connect-dialog">
          <DialogHeader>
            <DialogTitle>Add this agent to your library to connect {platformName}?</DialogTitle>
            <DialogDescription>
              Connecting to {platformName} requires this agent to be in the library so your teammates can use the bot.
              We&apos;ll add it to the library and then continue to {platformName}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={updateStoredAgent.isPending}
              data-testid="agent-builder-publish-before-connect-dialog-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleConfirm}
              disabled={updateStoredAgent.isPending}
              data-testid="agent-builder-publish-before-connect-dialog-confirm"
            >
              Add to library &amp; continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    ),
    [confirmOpen, handleCancel, handleConfirm, platformName, updateStoredAgent.isPending],
  );

  const channelDialog = activeChannelDialog ? (
    <ChannelDialog
      platform={activeChannelDialog.platform}
      agentId={agentId}
      installation={activeChannelDialog.installation}
      open
      onOpenChange={open => {
        if (!open) setActiveChannelDialog(null);
      }}
    />
  ) : null;

  return { requestPublishAndConnect, dialog, channelDialog };
}
