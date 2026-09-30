import type { BadgeIndicator, BadgeVariant } from '@mastra/playground-ui/components/Badge';
import type { StreamStatus } from '../../hooks/use-browser-stream';

type StreamStatusBadge = {
  variant: BadgeVariant;
  indicator: BadgeIndicator;
  label: string;
};

export const streamStatusBadges = {
  idle: { variant: 'neutral', indicator: 'dot', label: 'Idle' },
  connecting: { variant: 'warning', indicator: 'pulse', label: 'Connecting' },
  connected: { variant: 'warning', indicator: 'pulse', label: 'Connected' },
  browser_starting: { variant: 'warning', indicator: 'pulse', label: 'Starting' },
  streaming: { variant: 'success', indicator: 'dot', label: 'Live' },
  browser_closed: { variant: 'neutral', indicator: 'dot', label: 'Closed' },
  disconnected: { variant: 'destructive', indicator: 'pulse', label: 'Disconnected' },
  error: { variant: 'destructive', indicator: 'dot', label: 'Error' },
} satisfies Record<StreamStatus, StreamStatusBadge>;
