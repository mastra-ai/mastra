import { CopyButton } from '../../../ds/components/CopyButton';
import { Txt } from '../../../ds/components/Txt';

export interface TraceErrorSummaryProps {
  name: string;
  message: string;
  /** Shown under the message, e.g. when only the preview could be loaded. */
  notice?: string;
}

/** An error's name and copy button over its full message, wrapped and scrollable. */
export function TraceErrorSummary({ name, message, notice }: TraceErrorSummaryProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border py-1 pr-1.5 pl-3">
        <Txt as="span" variant="caption" className="truncate font-medium text-destructive-foreground">
          {name}
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
      {notice && (
        <Txt as="p" variant="caption" tone="muted" className="px-3 pb-2.5">
          {notice}
        </Txt>
      )}
    </>
  );
}
