import { NotificationActivity } from '../../../ds/components/ai/activity';
import { Badge } from '../../../ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../ds/components/Tooltip/tooltip';
import { formatSignalValue, getMcpEventSignalInfo, getNotificationMetadata, signalContentsToText } from './signal-data';
import type { McpEventSignalInfo, SignalData } from './signal-data';

export type NotificationSignalNoticeProps = {
  signal: SignalData;
};

export const MCP_EVENT_GAP_MESSAGE = 'Gap: events may have been skipped';
export const MCP_EVENT_UNTRUSTED_LABEL = 'Untrusted event data from the MCP server';

const getNotificationTitle = (signal: SignalData) => {
  const notification = getNotificationMetadata(signal);
  if (notification?.signal === 'summary' || signal.tagName === 'notification-summary') return 'Notification summary';

  const source = notification?.source ?? formatSignalValue(signal.attributes?.source);
  const kind = notification?.kind ?? formatSignalValue(signal.attributes?.kind);
  if (source && kind) return `${source} / ${kind}`;
  return source ?? kind ?? 'Notification';
};

const getMcpEventTitle = (info: McpEventSignalInfo) => {
  const title = [info.server, info.event].filter(Boolean).join(' · ') || 'MCP event';
  return info.kind === 'mcp-event-subscription-ended' ? `${title} · subscription ended` : title;
};

const GapBadge = () => (
  <Tooltip>
    <TooltipTrigger render={<span />}>
      <Badge size="xs" variant="amber">
        gap
      </Badge>
      <span className="sr-only">{MCP_EVENT_GAP_MESSAGE}</span>
    </TooltipTrigger>
    <TooltipContent>{MCP_EVENT_GAP_MESSAGE}</TooltipContent>
  </Tooltip>
);

export const NotificationSignalNotice = ({ signal }: NotificationSignalNoticeProps) => {
  const notification = getNotificationMetadata(signal);
  const mcpEvent = getMcpEventSignalInfo(signal);
  const priority = notification?.priority ?? formatSignalValue(signal.attributes?.priority);
  const pending = formatSignalValue(notification?.pending) ?? formatSignalValue(signal.attributes?.pending);
  const status = notification?.status ?? formatSignalValue(signal.attributes?.status);
  const text = signalContentsToText(signal.contents);
  return (
    <NotificationActivity
      label={mcpEvent ? getMcpEventTitle(mcpEvent) : getNotificationTitle(signal)}
      message={text}
      priority={priority}
      status={status}
      pending={pending}
      extraBadges={mcpEvent?.truncated ? <GapBadge /> : undefined}
      messageLabel={mcpEvent?.kind === 'mcp-event' ? MCP_EVENT_UNTRUSTED_LABEL : undefined}
    />
  );
};
