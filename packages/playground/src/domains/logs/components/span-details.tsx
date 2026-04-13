import type { SpanRecord } from '@mastra/core/storage';
import { DataDetailsPanel } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { BracesIcon, FileInputIcon, FileOutputIcon } from 'lucide-react';

const KV = DataDetailsPanel.KeyValueList;

export interface SpanDetailsProps {
  span: SpanRecord;
  onClose: () => void;
}

export function SpanDetails({ span, onClose }: SpanDetailsProps) {
  const durationMs =
    span.startedAt && span.endedAt ? new Date(span.endedAt).getTime() - new Date(span.startedAt).getTime() : null;

  return (
    <DataDetailsPanel>
      <DataDetailsPanel.Header>
        <DataDetailsPanel.Heading>
          Span <b># {span.spanId}</b>
        </DataDetailsPanel.Heading>
        <DataDetailsPanel.CloseButton onClick={onClose} />
      </DataDetailsPanel.Header>

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
    </DataDetailsPanel>
  );
}
