import type { BadgeIndicator, BadgeVariant } from '@mastra/playground-ui/components/Badge';
import type { StreamStatus } from '../../hooks/use-browser-stream';

type StreamStatusBadge = {
  variant: BadgeVariant;
  indicator: BadgeIndicator;
  label: string;
};

export const streamStatusBadges = {
  idle: { variant: 'default', indicator: 'dot', label: 'Idle' },
  connecting: { variant: 'warning', indicator: 'pulse', label: 'Connecting' },
  connected: { variant: 'warning', indicator: 'pulse', label: 'Connected' },
  browser_starting: { variant: 'warning', indicator: 'pulse', label: 'Starting' },
  streaming: { variant: 'success', indicator: 'dot', label: 'Live' },
  browser_closed: { variant: 'default', indicator: 'dot', label: 'Closed' },
  disconnected: { variant: 'error', indicator: 'pulse', label: 'Disconnected' },
  error: { variant: 'error', indicator: 'dot', label: 'Error' },
} satisfies Record<StreamStatus, StreamStatusBadge>;
