import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';

export type MessageRowProps = {
  /** Who is speaking: the user answers from the right, everything the agent does stays left. */
  side?: 'left' | 'right';
  /** Measurements printed under the message, e.g. wall clock, duration, tokens. */
  meta?: (string | undefined)[];
  as?: 'li' | 'div';
  testId?: string;
  dataError?: string;
  /** Hover text carrying details that would clutter the row, e.g. the humanized span name. */
  title?: string;
  /** Trailing control beside the message, e.g. the comment bubble. */
  action?: ReactNode;
  children?: ReactNode;
};

/**
 * One message in the turn, laid out like a chat rather than a timeline: no rail, no category
 * label, just the message on its side of the pane with its measurements underneath. The bubble
 * itself is left to the caller — a tool call and a sentence of prose want different chrome.
 */
export function MessageRow({
  side = 'left',
  meta,
  as: Tag = 'div',
  testId,
  dataError,
  title,
  action,
  children,
}: MessageRowProps) {
  const details = (meta ?? []).filter(Boolean);

  return (
    <Tag
      className={cn('group/message-row flex flex-col py-2', side === 'right' && 'items-end')}
      data-testid={testId}
      data-side={side}
      data-error={dataError}
      title={title}
    >
      {/* The message stops short of the full width so the two sides stay legible as sides, but the
          row itself spans it: the action then parks on the far edge instead of trailing the text. */}
      <div className={cn('flex w-full items-start gap-1', side === 'right' && 'flex-row-reverse')}>
        <div className="max-w-[92%] min-w-0">{children}</div>
        {action ? <div className={cn('shrink-0', side === 'right' ? 'mr-auto' : 'ml-auto')}>{action}</div> : null}
      </div>

      {details.length > 0 ? (
        <p
          className={cn(
            // Measurements are noise until asked for: they hold their space so the thread does not
            // jump, but only surface on hover or when the row is focused.
            'text-neutral3 text-ui-xs duration-normal mt-1 font-mono tabular-nums opacity-0 transition-opacity',
            'group-focus-within/message-row:opacity-100 group-hover/message-row:opacity-100',
            side === 'right' && 'text-right',
          )}
          data-testid="message-row-meta"
        >
          {details.join(' · ')}
        </p>
      ) : null}
    </Tag>
  );
}
