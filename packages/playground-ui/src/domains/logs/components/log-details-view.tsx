import { format } from 'date-fns';
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { LogRecord } from '../types';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataDetailsPanel } from '@/ds/components/DataDetailsPanel';
import { cn } from '@/lib/utils';

const KV = DataDetailsPanel.KeyValueList;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export interface LogDetailsViewProps {
  log: LogRecord;
  onClose: () => void;
  onTraceClick?: (traceId: string) => void;
  onSpanClick?: (traceId: string, spanId: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function LogDetailsView({
  log,
  onClose,
  onTraceClick,
  onSpanClick,
  onPrevious,
  onNext,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: LogDetailsViewProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;
  const date = toDate(log.timestamp);
  const traceId = log.traceId;
  const spanId = log.spanId;

  return (
    <DataDetailsPanel collapsed={collapsed}>
      <DataDetailsPanel.Header>
        <DataDetailsPanel.Heading>
          Log <b>{format(date, 'MMM dd, HH:mm:ss.SSS')}</b>
        </DataDetailsPanel.Heading>
        <ButtonsGroup className="ml-auto shrink-0">
          {onCollapsedChange && (
            <Button
              size="md"
              tooltip={collapsed ? 'Expand panel' : 'Collapse panel'}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
            </Button>
          )}

          <ButtonsGroup spacing="close">
            <Button size="md" tooltip="Previous log" onClick={onPrevious} disabled={!onPrevious}>
              <ArrowUpIcon />
            </Button>
            <Button size="md" tooltip="Next log" onClick={onNext} disabled={!onNext}>
              <ArrowDownIcon />
            </Button>
          </ButtonsGroup>

          <DataDetailsPanel.CloseButton onClick={onClose} />
        </ButtonsGroup>
      </DataDetailsPanel.Header>

      {!collapsed && (
        <DataDetailsPanel.Content>
          <p className="font-mono text-ui-md wrap-break-word whitespace-pre-wrap text-neutral4">{log.message}</p>

          {(traceId || spanId) && (
            <div className={cn('my-8 grid gap-2', '[&>button]:justify-between [&>button]:overflow-hidden')}>
              {traceId && (
                <ButtonsGroup spacing="close" className="w-full min-w-0">
                  <Button size="md" className="min-w-0 flex-1 overflow-hidden" onClick={() => onTraceClick?.(traceId)}>
                    <ArrowRightIcon />
                    <span>Trace</span>
                    <span className=" ml-auto min-w-0 truncate text-ui-sm text-neutral2"># {traceId}</span>
                  </Button>
                  <CopyButton content={traceId} size="md" tooltip="Copy Trace ID to clipboard" />
                </ButtonsGroup>
              )}
              {spanId && (
                <ButtonsGroup spacing="close" className="w-full min-w-0">
                  <Button
                    size="md"
                    className="min-w-0 flex-1 overflow-hidden"
                    disabled={!traceId || !onSpanClick}
                    onClick={() => traceId && onSpanClick?.(traceId, spanId)}
                  >
                    <ArrowRightIcon />
                    <span>Span</span>
                    <span className=" ml-auto min-w-0 truncate text-ui-sm text-neutral2"># {spanId}</span>
                  </Button>
                  <CopyButton content={spanId} size="md" tooltip="Copy Span ID to clipboard" />
                </ButtonsGroup>
              )}
            </div>
          )}

          <KV className="mb-6">
            {log.entityType && (
              <>
                <KV.Key>Entity Type</KV.Key>
                <KV.Value>{log.entityType}</KV.Value>
              </>
            )}
            {log.entityName && (
              <>
                <KV.Key>Entity Name</KV.Key>
                <KV.Value>{log.entityName}</KV.Value>
              </>
            )}
            {log.serviceName && (
              <>
                <KV.Key>Service</KV.Key>
                <KV.Value>{log.serviceName}</KV.Value>
              </>
            )}
            {log.environment && (
              <>
                <KV.Key>Environment</KV.Key>
                <KV.Value>{log.environment}</KV.Value>
              </>
            )}
            {log.source && (
              <>
                <KV.Key>Source</KV.Key>
                <KV.Value>{log.source}</KV.Value>
              </>
            )}
            {log.metadata && Object.keys(log.metadata).length > 0 && (
              <>
                {Object.entries(log.metadata).map(([key, value]) => (
                  <Fragment key={key}>
                    <KV.Key>{key}</KV.Key>
                    <KV.Value>{String(value)}</KV.Value>
                  </Fragment>
                ))}
              </>
            )}
          </KV>

          {log.data && Object.keys(log.data).length > 0 && (
            <DataDetailsPanel.CodeSection title="Data" codeStr={JSON.stringify(log.data, null, 2)} className="mt-6" />
          )}
        </DataDetailsPanel.Content>
      )}
    </DataDetailsPanel>
  );
}
