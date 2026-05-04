import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface PublishChannelDialogProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  installation?: ChannelInstallationInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
