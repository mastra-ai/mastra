import type { SpanRecord } from '@mastra/core/storage';
import { format } from 'date-fns';
import { BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';
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
  const durationMs =
    span?.startedAt && span?.endedAt ? new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime() : null;

  return (
    <DataDetailsPanel>
      <DataDetailsPanel.Header>
        <DataDetailsPanel.Heading>
          Span <b># {spanId}</b>
        </DataDetailsPanel.Heading>
        <DataDetailsPanel.CloseButton onClick={onClose} />
      </DataDetailsPanel.Header>

      {isLoading ? (
        <DataDetailsPanel.LoadingData>Loading span...</DataDetailsPanel.LoadingData>
      ) : !span ? (
        <DataDetailsPanel.NoData>Span not found.</DataDetailsPanel.NoData>
      ) : (
        <DataDetailsPanel.Content>
          <KV>
            {span.spanType && (
              <>
                <KV.Key>Type</KV.Key>
                <KV.Value>{span.spanType}</KV.Value>
              </>
            )}
            {span.startedAt && (
              <>
                <KV.Key>Started</KV.Key>
                <KV.Value>{format(new Date(span.startedAt), 'MMM dd, HH:mm:ss.SSS')}</KV.Value>
              </>
            )}
            {span.endedAt && (
              <>
                <KV.Key>Ended</KV.Key>
                <KV.Value>{format(new Date(span.endedAt), 'MMM dd, HH:mm:ss.SSS')}</KV.Value>
              </>
            )}
            {durationMs != null && (
              <>
                <KV.Key>Duration</KV.Key>
                <KV.Value>{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(2)}s`}</KV.Value>
              </>
            )}
          </KV>

          <br />

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
