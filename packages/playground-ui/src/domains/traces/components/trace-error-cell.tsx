import { DataList } from '../../../ds/components/DataList';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../../../ds/components/HoverCard';
import { TraceErrorDetails } from './trace-error-details';

export interface TraceErrorCellProps {
  traceId: string;
  spanId: string;
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
