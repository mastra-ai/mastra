import { Button, ButtonWithTooltip, CopyButton, DataDetailsPanel, cn, ButtonsGroup } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Fragment, useState } from 'react';
import type { LogRecord } from '../types';

const KV = DataDetailsPanel.KeyValueList;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export interface LogDetailsProps {
  log: LogRecord;
  onClose: () => void;
  onTraceClick?: (traceId: string) => void;
  onSpanClick?: (traceId: string, spanId: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function LogDetails({
  log,
  onClose,
  onTraceClick,
  onSpanClick,
  onPrevious,
  onNext,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: LogDetailsProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;
  const date = toDate(log.timestamp);

  return (
    <DataDetailsPanel collapsed={collapsed}>
      <DataDetailsPanel.Header>
        <DataDetailsPanel.Heading>
          Log <b>{format(date, 'MMM dd, HH:mm:ss.SSS')}</b>
        </DataDetailsPanel.Heading>
        <ButtonsGroup className="ml-auto shrink-0">
          {onCollapsedChange && (
            <ButtonWithTooltip
              size="md"
              tooltipContent={collapsed ? 'Expand panel' : 'Collapse panel'}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronsUpDownIcon /> : <ChevronsDownUpIcon />}
            </ButtonWithTooltip>
          )}

          <ButtonsGroup spacing="close">
            <ButtonWithTooltip size="md" tooltipContent="Previous log" onClick={onPrevious} disabled={!onPrevious}>
              <ArrowUpIcon />
            </ButtonWithTooltip>
            <ButtonWithTooltip size="md" tooltipContent="Next log" onClick={onNext} disabled={!onNext}>
              <ArrowDownIcon />
            </ButtonWithTooltip>
          </ButtonsGroup>

          <DataDetailsPanel.CloseButton onClick={onClose} />
        </ButtonsGroup>
      </DataDetailsPanel.Header>

      {!collapsed && (
        <DataDetailsPanel.Content>
          <p className="text-ui-md text-neutral4 font-mono wrap-break-word whitespace-pre-wrap">{log.message}</p>

          {(log.traceId || log.spanId) && (
            <div className={cn('grid gap-2 my-8', '[&>button]:justify-between [&>button]:overflow-hidden')}>
              {log.traceId && (
                <ButtonsGroup spacing="close" className="min-w-0 w-full">
                  <Button
                    size="md"
                    className="min-w-0 flex-1 overflow-hidden"
                    onClick={() => onTraceClick?.(log.traceId!)}
                  >
                    <ArrowRightIcon />
                    <span>Trace</span>
                    <span className=" ml-auto text-ui-sm text-neutral2 min-w-0 truncate"># {log.traceId}</span>
                  </Button>
                  <CopyButton content={log.traceId!} size="md" tooltip="Copy Trace ID to clipboard" />
                </ButtonsGroup>
              )}
              {log.spanId && (
                <ButtonsGroup spacing="close" className="min-w-0 w-full">
                  <Button
                    size="md"
                    className="min-w-0 flex-1 overflow-hidden"
                    disabled={!log.traceId || !onSpanClick}
                    onClick={() => log.traceId && onSpanClick?.(log.traceId, log.spanId!)}
                  >
                    <ArrowRightIcon />
                    <span>Span</span>
                    <span className=" ml-auto text-ui-sm text-neutral2 min-w-0 truncate"># {log.spanId}</span>
                  </Button>
                  <CopyButton content={log.spanId!} size="md" tooltip="Copy Span ID to clipboard" />
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
                <KV.Header>Metadata</KV.Header>
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
