import type { SpanRecord } from '@mastra/core/storage';
import { format } from 'date-fns';
import { BracesIcon, FileInputIcon, FileOutputIcon, HashIcon } from 'lucide-react';
import { DataDetailsPanel } from '@/ds/components/DataDetailsPanel';
import { cn } from '@/lib/utils';

export interface SpanDetailsProps {
  span: SpanRecord;
  onClose: () => void;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b border-border1 last:border-b-0">
      <span className="text-ui-xs text-neutral2 shrink-0">{label}</span>
      <span className="text-ui-xs text-neutral4 font-mono truncate">{value}</span>
    </div>
  );
}

export function SpanDetails({ span, onClose }: SpanDetailsProps) {
  const finishReason = span?.attributes?.finishReason as string | undefined;

  return (
    <DataDetailsPanel>
      <DataDetailsPanel.Header>
        <DataDetailsPanel.Heading>
          Span <b>{span.spanId}</b>
        </DataDetailsPanel.Heading>
        <DataDetailsPanel.CloseButton onClick={onClose} />
      </DataDetailsPanel.Header>

      <DataDetailsPanel.Content>
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Span ID */}
          <div className="flex items-center gap-1.5 min-w-0">
            <HashIcon className={cn('size-3 text-neutral2 shrink-0')} />
            <span className="text-ui-xs text-neutral3 font-mono truncate">{span.spanId}</span>
          </div>

          {/* Info */}
          <div>
            <DetailRow label="Type" value={span.spanType} />
            <DetailRow label="Started" value={span.startedAt ? format(new Date(span.startedAt), 'MMM dd, HH:mm:ss.SSS') : undefined} />
            <DetailRow label="Ended" value={span.endedAt ? format(new Date(span.endedAt), 'MMM dd, HH:mm:ss.SSS') : undefined} />
            {span.startedAt && span.endedAt && (
              <DetailRow
                label="Duration"
                value={`${new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime()}ms`}
              />
            )}
            {finishReason && <DetailRow label="Finish Reason" value={finishReason} />}
          </div>

          {/* Code sections */}
          <DataDetailsPanel.CodeSection title="Input" icon={<FileInputIcon />} codeStr={JSON.stringify(span.input ?? null, null, 2)} />
          <DataDetailsPanel.CodeSection title="Output" icon={<FileOutputIcon />} codeStr={JSON.stringify(span.output ?? null, null, 2)} />
          <DataDetailsPanel.CodeSection title="Metadata" icon={<BracesIcon />} codeStr={JSON.stringify(span.metadata ?? null, null, 2)} />
          <DataDetailsPanel.CodeSection title="Attributes" icon={<BracesIcon />} codeStr={JSON.stringify(span.attributes ?? null, null, 2)} />
        </div>
      </DataDetailsPanel.Content>
    </DataDetailsPanel>
  );
}
