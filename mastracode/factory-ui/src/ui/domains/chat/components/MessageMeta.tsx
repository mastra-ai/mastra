import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { cn } from '@mastra/playground-ui/utils/cn';

export const MESSAGE_HOVER = 'group/message';

/** One clock across the transcript: message times and quoted channel history read the same. */
export const messageClock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const calendar = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' });

export function MessageMeta({ text, createdAt, align }: { text: string; createdAt: Date; align: 'start' | 'end' }) {
  // Thread history arrives as JSON, so the typed Date is an ISO string at runtime.
  const time = new Date(createdAt);

  return (
    <div
      className={cn(
        'mt-1 flex items-center gap-1 opacity-0 transition-opacity group-focus-within/message:opacity-100 group-hover/message:opacity-100',
        align === 'end' && 'flex-row-reverse',
      )}
    >
      <CopyButton content={text} size="icon-xs" variant="ghost" tooltip="Copy message" showToast={false} />
      <time className="text-ui-xs text-icon3" dateTime={time.toISOString()} title={calendar.format(time)}>
        {messageClock.format(time)}
      </time>
    </div>
  );
}
