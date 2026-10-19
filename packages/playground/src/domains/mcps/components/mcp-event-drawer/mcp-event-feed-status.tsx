import { Badge } from '@mastra/playground-ui/components/Badge';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { EventFeedStatus } from '../../hooks/use-mcp-event-feed';

export interface McpEventFeedStatusProps {
  status: EventFeedStatus;
  canStream: boolean;
  cursor?: string;
}

const STATUS_LABELS: Record<Exclude<EventFeedStatus, 'live'>, string> = {
  idle: 'Not listening',
  connecting: 'Connecting…',
  polling: 'Polling…',
  stopped: 'Stopped',
  error: 'Failed',
};

function StatusLabel({ status, canStream }: Pick<McpEventFeedStatusProps, 'status' | 'canStream'>) {
  if (status === 'live') {
    return (
      <Badge variant="green" indicator="pulse" size="sm">
        Listening
      </Badge>
    );
  }
  const label = status === 'idle' && !canStream ? 'Not polled yet' : STATUS_LABELS[status];
  return (
    <span className="flex items-center gap-2">
      {(status === 'connecting' || status === 'polling') && <Spinner size="sm" />}
      <Txt as="span" tone="muted">
        {label}
      </Txt>
    </span>
  );
}

/** Where the feed is (listening, stopped, …) and the cursor it resumes from. */
export function McpEventFeedStatus({ status, canStream, cursor }: McpEventFeedStatusProps) {
  return (
    <div role="status" className="flex min-w-0 flex-wrap items-center gap-3">
      <StatusLabel status={status} canStream={canStream} />
      {cursor && (
        <span className="flex min-w-0 items-center gap-1">
          <Txt as="span" variant="caption" tone="muted">
            Cursor
          </Txt>
          <Txt as="span" variant="caption" font="mono" className="min-w-0 truncate">
            {cursor}
          </Txt>
          <CopyButton tooltip="Copy cursor" content={cursor} />
        </span>
      )}
    </div>
  );
}
