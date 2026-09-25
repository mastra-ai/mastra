import { ArrowRightIcon } from 'lucide-react';
import { Fragment } from 'react';
import type { LogRecord } from '../types';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataKeysAndValues } from '@/ds/components/DataKeysAndValues';
import { DataPanel } from '@/ds/components/DataPanel';
import { formatTimestampPrecise } from '@/utils/date-format';

export interface LogDataPanelProps {
  /** Always mount the panel and pass `undefined` to close it, so the drawer can animate out. */
  log?: LogRecord;
  onClose: () => void;
  onTraceClick?: (traceId: string) => void;
  onSpanClick?: (traceId: string, spanId: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  depth?: 1 | 2 | 3;
}

export function LogDataPanel({
  log,
  onClose,
  onTraceClick,
  onSpanClick,
  onPrevious,
  onNext,
  depth,
}: LogDataPanelProps) {
  const formattedDate = log ? (formatTimestampPrecise(log.timestamp) ?? '') : '';

  return (
    <DataPanel open={!!log} onClose={onClose} title={log ? `Log ${formattedDate}` : 'Log'} depth={depth}>
      {log && (
        <>
          <DataPanel.Header>
            <DataPanel.CloseButton onClick={onClose} />
            <DataPanel.Heading>Log · {formattedDate}</DataPanel.Heading>
            <DataPanel.HeaderActions>
              <DataPanel.NextPrevNav
                onPrevious={onPrevious}
                onNext={onNext}
                previousLabel="Go to previous log"
                nextLabel="Go to next log"
              />
            </DataPanel.HeaderActions>
          </DataPanel.Header>

          <DataPanel.Content>
            <div className="grid gap-6 p-2">
              <DataKeysAndValues>
                {log.entityType && (
                  <>
                    <DataKeysAndValues.Key>Entity Type</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>{log.entityType}</DataKeysAndValues.Value>
                  </>
                )}
                {log.entityName && (
                  <>
                    <DataKeysAndValues.Key>Entity Name</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>{log.entityName}</DataKeysAndValues.Value>
                  </>
                )}
                {log.serviceName && (
                  <>
                    <DataKeysAndValues.Key>Service</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>{log.serviceName}</DataKeysAndValues.Value>
                  </>
                )}
                {log.environment && (
                  <>
                    <DataKeysAndValues.Key>Environment</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>{log.environment}</DataKeysAndValues.Value>
                  </>
                )}
                {log.source && (
                  <>
                    <DataKeysAndValues.Key>Source</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>{log.source}</DataKeysAndValues.Value>
                  </>
                )}
                {log.metadata &&
                  Object.entries(log.metadata).map(([key, value]) => (
                    <Fragment key={key}>
                      <DataKeysAndValues.Key>{key}</DataKeysAndValues.Key>
                      <DataKeysAndValues.Value>{String(value)}</DataKeysAndValues.Value>
                    </Fragment>
                  ))}
              </DataKeysAndValues>

              <DataPanel.CodeSection title="Message" codeStr={log.message} simplified />

              {(log.traceId || log.spanId) && (
                <div className="grid gap-2">
                  {log.traceId && (
                    <ButtonsGroup className="w-full min-w-0">
                      <Button
                        className="min-w-0 flex-1 justify-between overflow-hidden"
                        icon={<ArrowRightIcon />}
                        onClick={() => log.traceId && onTraceClick?.(log.traceId)}
                      >
                        <span>Trace</span>
                        <span className="ml-auto min-w-0 truncate text-caption text-placeholder"># {log.traceId}</span>
                      </Button>
                      <CopyButton content={log.traceId} tooltip="Copy Trace ID to clipboard" />
                    </ButtonsGroup>
                  )}
                  {log.spanId && (
                    <ButtonsGroup className="w-full min-w-0">
                      <Button
                        className="min-w-0 flex-1 justify-between overflow-hidden"
                        disabled={!log.traceId || !onSpanClick}
                        onClick={() => log.traceId && log.spanId && onSpanClick?.(log.traceId, log.spanId)}
                        icon={<ArrowRightIcon />}
                      >
                        <span>Span</span>
                        <span className="ml-auto min-w-0 truncate text-caption text-placeholder"># {log.spanId}</span>
                      </Button>
                      <CopyButton content={log.spanId} tooltip="Copy Span ID to clipboard" />
                    </ButtonsGroup>
                  )}
                </div>
              )}

              {log.data && Object.keys(log.data).length > 0 && (
                <DataPanel.CodeSection title="Data" codeStr={JSON.stringify(log.data, null, 2)} />
              )}
            </div>
          </DataPanel.Content>
        </>
      )}
    </DataPanel>
  );
}
