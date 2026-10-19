import { describeSpanError } from '@mastra/core/observability';
import { useSpanDetail } from '@mastra/react/hooks/traces';
import { asCoreSpan } from './span-payload/span-payload-registry';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataList } from '@/ds/components/DataList';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/ds/components/HoverCard';
import { Txt } from '@/ds/components/Txt';

export interface TraceErrorCellProps {
  traceId: string;
  spanId?: string | null;
  /** The stored preview, shown in the cell and in the card until the full error loads. */
  errorPreview: string;
}

/** Output cell of a failed row: the error preview, and the full error in a hover card. */
export function TraceErrorCell({ traceId, spanId, errorPreview }: TraceErrorCellProps) {
  return (
    <HoverCard>
      <HoverCardTrigger
        render={
          <DataList.TextCell font="mono" className="text-destructive-foreground">
            {errorPreview}
          </DataList.TextCell>
        }
      />
      <HoverCardContent
        side="bottom"
        align="start"
        showArrow={false}
        className="w-100 p-0"
        // The card is portaled, but React still bubbles its clicks to the row button.
        onClick={event => event.stopPropagation()}
      >
        <TraceErrorDetails traceId={traceId} spanId={spanId} errorPreview={errorPreview} />
      </HoverCardContent>
    </HoverCard>
  );
}

// Mounted only while the card is open, so the span is fetched on first hover (and cached for the drawer).
function TraceErrorDetails({ traceId, spanId, errorPreview }: TraceErrorCellProps) {
  const { data } = useSpanDetail({ traceId, spanId, queryOptions: { enabled: !!spanId } });
  const error = data ? describeSpanError(asCoreSpan(data.span)) : undefined;
  const message = error?.message ?? errorPreview;

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border py-1 pr-1.5 pl-3">
        <Txt as="span" variant="caption" className="truncate font-medium text-destructive-foreground">
          {error?.name ?? 'Error'}
        </Txt>
        <CopyButton content={message} tooltip="Copy error" />
      </div>
      <Txt
        as="p"
        variant="body-sm"
        font="mono"
        tone="ink"
        className="max-h-64 overflow-y-auto px-3 py-2.5 wrap-break-word whitespace-pre-wrap"
      >
        {message}
      </Txt>
    </>
  );
}
