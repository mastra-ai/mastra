import { useId } from 'react';
import type { ReactNode } from 'react';
import type { LogRecord } from '../types';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CardInset } from '@/ds/components/Card';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataPanel } from '@/ds/components/DataPanel';
import { logLevelTextClass } from '@/ds/components/LogsDataList';
import { Txt } from '@/ds/components/Txt';
import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';
import { cn } from '@/lib/utils';
import { formatTimestampPrecise } from '@/utils/date-format';

type InsetRow = { label: string; value: ReactNode; mono?: boolean };

function InsetSection({ title, rows }: { title: string; rows: InsetRow[] }) {
  const titleId = useId();
  if (rows.length === 0) return null;

  return (
    <section className="grid gap-2" aria-labelledby={titleId}>
      <DataPanel.SectionHeading>
        <span id={titleId}>{title}</span>
      </DataPanel.SectionHeading>
      <CardInset as="dl">
        {rows.map(row => (
          <div key={row.label} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <dt className="shrink-0">
              <Txt as="span" variant="body-sm" tone="muted">
                {row.label}
              </Txt>
            </dt>
            <dd className="ml-auto min-w-0 text-right wrap-anywhere">
              <Txt as="span" variant="body-sm" tone="ink" font={row.mono ? 'mono' : undefined}>
                {row.value}
              </Txt>
            </dd>
          </div>
        ))}
      </CardInset>
    </section>
  );
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function textRows(entries: Array<[string, unknown]>, mono?: boolean): InsetRow[] {
  return entries
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([label, value]) => ({ label, value: String(value), mono }));
}

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
  const dataEntries = Object.entries(log?.data ?? {});
  const dataIsFlat = dataEntries.every(([, value]) => isPrimitive(value));

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
              <InsetSection
                title="Details"
                rows={[
                  { label: 'Time', value: formattedDate, mono: true },
                  {
                    label: 'Level',
                    value: <span className={cn('uppercase', logLevelTextClass[log.level])}>{log.level}</span>,
                    mono: true,
                  },
                  ...textRows([
                    ['Entity type', log.entityType],
                    ['Entity name', log.entityName],
                    ['Service', log.serviceName],
                    ['Environment', log.environment],
                    ['Source', log.source],
                  ]),
                ]}
              />

              <DataPanel.CodeSection title="Message" codeStr={log.message} simplified />

              {dataIsFlat ? (
                <InsetSection title="Fields" rows={textRows(dataEntries, true)} />
              ) : (
                <DataPanel.CodeSection title="Data" codeStr={JSON.stringify(log.data, null, 2)} />
              )}

              <InsetSection title="Metadata" rows={textRows(Object.entries(log.metadata ?? {}), true)} />

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
