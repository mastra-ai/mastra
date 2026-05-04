import type { ComponentType } from 'react';
import { DefaultChannelDialog } from './default-channel-dialog';
import { SlackChannelDialog } from './slack-channel-dialog';
import type { PublishChannelDialogProps } from './types';

export type { PublishChannelDialogProps } from './types';
export { DefaultChannelDialog } from './default-channel-dialog';
export { SlackChannelDialog } from './slack-channel-dialog';
export { DisconnectChannelConfirmDialog } from './disconnect-channel-confirm-dialog';
export type { DisconnectChannelConfirmDialogProps } from './disconnect-channel-confirm-dialog';

const REGISTRY: Record<string, ComponentType<PublishChannelDialogProps>> = {
  slack: SlackChannelDialog,
};

export function getPublishChannelDialog(platformId: string): ComponentType<PublishChannelDialogProps> {
  return REGISTRY[platformId] ?? DefaultChannelDialog;
}
