import type { McpServerEventInfo } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useState } from 'react';
import { useMcpEventFeed } from '../../hooks/use-mcp-event-feed';
import { McpEventArgumentsForm } from './mcp-event-arguments-form';
import { McpEventFeedList } from './mcp-event-feed-list';
import { McpEventFeedStatus } from './mcp-event-feed-status';
import { McpEventTestEmit } from './mcp-event-test-emit';

export interface McpEventLivePanelProps {
  serverId: string;
  event: McpServerEventInfo;
  /** The server serves test emit (under `mastra dev`). */
  testEmit: boolean;
}

/** Watch an event type: stream it (push types) or poll it, and send test events under `mastra dev`. */
export function McpEventLivePanel({ serverId, event, testEmit }: McpEventLivePanelProps) {
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const feed = useMcpEventFeed(serverId, event.name);
  const canStream = event.delivery.includes('push');
  const isStreaming = feed.status === 'connecting' || feed.status === 'live';

  return (
    <div className="grid content-start gap-6">
      <McpEventArgumentsForm inputSchema={event.inputSchema} onChange={setArgs} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <McpEventFeedStatus status={feed.status} canStream={canStream} cursor={feed.cursor} />
        {canStream && isStreaming && <Button onClick={feed.stop}>Stop</Button>}
        {canStream && !isStreaming && (
          <Button variant="primary" onClick={() => void feed.start(args)}>
            Start
          </Button>
        )}
        {!canStream && (
          <Button variant="primary" disabled={feed.status === 'polling'} onClick={() => void feed.pollOnce(args)}>
            Poll once
          </Button>
        )}
      </div>

      {feed.error && <Notice variant="destructive">{feed.error}</Notice>}
      {feed.warning && <Notice variant="warning">{feed.warning}</Notice>}

      {testEmit && event.emittable && (
        <McpEventTestEmit
          serverId={serverId}
          event={event}
          // A streamed type shows the test event through the open stream; a poll-only one needs a poll.
          onEmitted={canStream ? undefined : () => void feed.pollOnce(args)}
        />
      )}

      <McpEventFeedList items={feed.items} />
    </div>
  );
}
