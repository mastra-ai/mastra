import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { cn } from '@mastra/playground-ui/utils/cn';

/** Hover scope a message opens so its meta row can surface with the message. */
export const MESSAGE_HOVER = 'group/message';

const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** When the message landed and a way to take its text, kept out of sight until the message is hovered. */
export function MessageMeta({ text, createdAt, align }: { text: string; createdAt: Date; align: 'start' | 'end' }) {
  // Thread history arrives as JSON, so the typed Date is an ISO string at runtime.
  const time = new Date(createdAt);

  return (
    <div
      className={cn(
        'flex items-center gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100',
        align === 'end' && 'flex-row-reverse',
      )}
    >
      <CopyButton content={text} size="icon-xs" variant="ghost" tooltip="Copy message" />
      <time className="text-ui-xs text-icon3" dateTime={time.toISOString()}>
        {clock.format(time)}
      </time>
    </div>
  );
}
