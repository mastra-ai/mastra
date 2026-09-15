import type { SpanRecord } from '@mastra/core/storage';
import { BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';
import { SpanSummaryDescription } from './span-summary-description';
import { TraceIdButton } from './trace-id-button';
import { DataDetailsPanel } from '@/ds/components/DataDetailsPanel';

const KV = DataDetailsPanel.KeyValueList;

export interface SpanDetailsViewProps {
  spanId: string;
  /** Full span record. Caller fetches via useSpanDetail. */
  span: SpanRecord | undefined;
  isLoading?: boolean;
  onClose: () => void;
}

/**
 * Compact span panel using `DataDetailsPanel` (popover-style). Shows basic span metadata +
 * input/output/metadata/attributes code sections. Use this for inline span inspection; for the
 * full-width span view with scoring tab + prev/next nav, use `SpanDataPanelView`.
 */
export function SpanDetailsView({ spanId, span, isLoading, onClose }: SpanDetailsViewProps) {
  return (
    <DataDetailsPanel>
      <DataDetailsPanel.Header>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <DataDetailsPanel.Heading className="items-center">
            Span
            <TraceIdButton id={spanId} />
          </DataDetailsPanel.Heading>
          {span && <SpanSummaryDescription span={span} />}
        </div>
        <DataDetailsPanel.CloseButton onClick={onClose} />
      </DataDetailsPanel.Header>

      {isLoading ? (
        <DataDetailsPanel.LoadingData>Loading span...</DataDetailsPanel.LoadingData>
      ) : !span ? (
        <DataDetailsPanel.NoData>Span not found.</DataDetailsPanel.NoData>
      ) : (
        <DataDetailsPanel.Content>
          {span.spanType && (
            <>
              <KV>
                <KV.Key>Type</KV.Key>
                <KV.Value>{span.spanType}</KV.Value>
              </KV>
              <br />
            </>
          )}

          <DataDetailsPanel.CodeSection
            title="Input"
            icon={<FileInputIcon />}
            codeStr={JSON.stringify(span.input ?? null, null, 2)}
          />
          <DataDetailsPanel.CodeSection
            title="Output"
            icon={<FileOutputIcon />}
            codeStr={JSON.stringify(span.output ?? null, null, 2)}
          />
          <DataDetailsPanel.CodeSection
            title="Metadata"
            icon={<BracesIcon />}
            codeStr={JSON.stringify(span.metadata ?? null, null, 2)}
          />
          <DataDetailsPanel.CodeSection
            title="Attributes"
            icon={<BracesIcon />}
            codeStr={JSON.stringify(span.attributes ?? null, null, 2)}
          />
        </DataDetailsPanel.Content>
      )}
    </DataDetailsPanel>
  );
}
