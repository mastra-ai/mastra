import type { ReactNode } from 'react';
import type { LogRecord } from '../types';
import { LogDetailsSection } from './log-data-panel-sections/log-details-section';
import { LogMessageSection } from './log-data-panel-sections/log-message-section';
import { LogValuesSection } from './log-data-panel-sections/log-values-section';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataPanel } from '@/ds/components/DataPanel';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';
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
  /** Extra controls in the header, before the previous/next buttons. */
  actions?: ReactNode;
}

export function LogDataPanel({
  log,
  onClose,
  onTraceClick,
  onSpanClick,
  onPrevious,
  onNext,
  depth,
  actions,
}: LogDataPanelProps) {
  const formattedDate = log ? (formatTimestampPrecise(log.timestamp) ?? '') : '';

  return (
    <DataPanel open={!!log} onClose={onClose} title={log ? `Log ${formattedDate}` : 'Log'} depth={depth}>
      {log && (
        <>
          <DataPanel.Header>
            <DataPanel.CloseButton onClick={onClose} />
            <DataPanel.Heading>Log</DataPanel.Heading>
            <DataPanel.Metadata>
              <DataPanel.Meta tooltip={formattedDate}>{formattedDate}</DataPanel.Meta>
            </DataPanel.Metadata>
            <DataPanel.HeaderActions>
              {actions}
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
              <LogDetailsSection log={log} />
              <LogMessageSection message={log.message} />
              <LogValuesSection title="Fields" values={log.data} />
              <LogValuesSection title="Metadata" values={log.metadata} />

              {(log.traceId || log.spanId) && (
                <div className="grid gap-2">
                  {log.traceId && (
                    <ButtonsGroup className="w-full min-w-0">
                      <Button
                        className="min-w-0 flex-1 justify-between overflow-hidden"
                        icon={<IconArrowRight />}
                        onClick={() => log.traceId && onTraceClick?.(log.traceId)}
                      >
                        <span>Trace</span>
                        <Txt as="span" variant="caption" tone="faint" className="ml-auto min-w-0 truncate">
                          # {log.traceId}
                        </Txt>
                      </Button>
                      <CopyButton content={log.traceId} tooltip="Copy trace ID to clipboard" />
                    </ButtonsGroup>
                  )}
                  {log.spanId && (
                    <ButtonsGroup className="w-full min-w-0">
                      <Button
                        className="min-w-0 flex-1 justify-between overflow-hidden"
                        disabled={!log.traceId || !onSpanClick}
                        onClick={() => log.traceId && log.spanId && onSpanClick?.(log.traceId, log.spanId)}
                        icon={<IconArrowRight />}
                      >
                        <span>Span</span>
                        <Txt as="span" variant="caption" tone="faint" className="ml-auto min-w-0 truncate">
                          # {log.spanId}
                        </Txt>
                      </Button>
                      <CopyButton content={log.spanId} tooltip="Copy span ID to clipboard" />
                    </ButtonsGroup>
                  )}
                </div>
              )}
            </div>
          </DataPanel.Content>
        </>
      )}
    </DataPanel>
  );
}
