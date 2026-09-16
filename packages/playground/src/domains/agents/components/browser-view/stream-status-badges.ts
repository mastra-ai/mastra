import type { BadgeIndicator, BadgeVariant } from '@mastra/playground-ui/components/Badge';
import type { StreamStatus } from '../../hooks/use-browser-stream';

type StreamStatusBadge = {
  variant: BadgeVariant;
  indicator: BadgeIndicator;
  label: string;
};

export const streamStatusBadges = {
  idle: { variant: 'neutral', indicator: 'dot', label: 'Idle' },
  connecting: { variant: 'yellow', indicator: 'pulse', label: 'Connecting' },
  connected: { variant: 'yellow', indicator: 'pulse', label: 'Connected' },
  browser_starting: { variant: 'yellow', indicator: 'pulse', label: 'Starting' },
  streaming: { variant: 'green', indicator: 'dot', label: 'Live' },
  browser_closed: { variant: 'neutral', indicator: 'dot', label: 'Closed' },
  disconnected: { variant: 'red', indicator: 'pulse', label: 'Disconnected' },
  error: { variant: 'red', indicator: 'dot', label: 'Error' },
} satisfies Record<StreamStatus, StreamStatusBadge>;
