import { CheckIcon, CopyIcon } from 'lucide-react';
import { formatSignalValue } from '@/domains/chat/messages/signal-data';
import type { SignalData } from '@/domains/chat/messages/signal-data';
import { Badge } from '@/ds/components/Badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons/Icon';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { cn } from '@/lib/utils';

const badgeLabel = 'shrink-0 text-placeholder';

/** One field of the signal as a badge: a faint label, then its value, truncated with the full text on hover. */
function SignalDetail({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex min-w-0">
      <Badge variant="neutral" emphasis="subtle" size="sm" title={value}>
        <span className={badgeLabel}>{label}</span>
        <span className="min-w-0 truncate">{value}</span>
      </Badge>
    </li>
  );
}

/** The id shortened to 6 characters like the trace and span ids; clicking copies the full value. */
function SignalId({ id }: { id: string }) {
  const { isCopied, handleCopy } = useCopyToClipboard({ text: id, showToast: false });
  return (
    <li className="flex">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy signal id ${id}`}
              className="group flex cursor-pointer rounded-[7px] outline-hidden focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-border-focus focus-visible:outline-solid"
            />
          }
        >
          <Badge variant="neutral" emphasis="subtle" size="sm" className="group-hover:bg-fill">
            <span className={badgeLabel}>Signal id</span>
            {id.slice(0, 6)}
            <Icon size="xs">{isCopied ? <CheckIcon /> : <CopyIcon />}</Icon>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{isCopied ? 'Copied to clipboard' : 'Copy to clipboard'}</TooltipContent>
      </Tooltip>
    </li>
  );
}

/**
 * The signal's metadata as a wrapping row of badges: type, tag, attributes, then its copyable id.
 * A user signal's row is the footer of its bubble, so it wraps toward the right like the bubble,
 * and skips the type and tag the bubble already conveys.
 */
export function SignalDetails({ signal, isUser }: { signal: SignalData; isUser: boolean }) {
  const attributes = Object.entries(signal.attributes ?? {});
  return (
    <ul
      aria-label="Signal"
      data-slot="span-signal-details"
      className={cn('flex min-w-0 flex-wrap items-center gap-1', isUser && 'justify-end')}
    >
      {!isUser && signal.type !== undefined && <SignalDetail label="Type" value={signal.type} />}
      {!isUser && signal.tagName !== undefined && <SignalDetail label="Tag" value={signal.tagName} />}
      {attributes.map(([key, value]) => (
        <SignalDetail key={key} label={key} value={formatSignalValue(value) ?? String(value)} />
      ))}
      {signal.id !== undefined && <SignalId id={signal.id} />}
    </ul>
  );
}
