import { format } from 'date-fns';
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon, ChevronsDownUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import type { LogRecord } from '../types';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { CopyButton } from '@/ds/components/CopyButton';
import { DataDetailsPanel } from '@/ds/components/DataDetailsPanel';
import { cn } from '@/lib/utils';

const KV = DataDetailsPanel.KeyValueList;

const MESSAGE_TRUNCATE_LENGTH = 300;

function isValidJson(s: string): boolean {
  const trimmed = s.trimStart();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') return false;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

function isSimpleMetadataValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.length > MESSAGE_TRUNCATE_LENGTH) return false;
  const trimmed = value.trimStart();
  if (trimmed[0] === '{' || trimmed[0] === '[') {
    try {
      JSON.parse(value);
      return false;
    } catch {
      // not JSON, falls through to true
    }
  }
  return true;
}

function metadataCodeStr(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

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
  const [messageExpanded, setMessageExpanded] = useState(false);
  useEffect(() => {
    setMessageExpanded(false);
  }, [log.message, log.timestamp]);
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;
  const date = toDate(log.timestamp);
  const isJsonMsg = isValidJson(log.message);

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
          {isJsonMsg ? (
            <DataDetailsPanel.CodeSection title="Message" codeStr={log.message} className="mb-6" />
          ) : (
            <div className="mb-6">
              <p className="text-ui-md text-neutral4 font-mono wrap-break-word whitespace-pre-wrap">
                {messageExpanded ? log.message : log.message.slice(0, MESSAGE_TRUNCATE_LENGTH)}
              </p>
              {log.message.length > MESSAGE_TRUNCATE_LENGTH && (
                <button
                  type="button"
                  className="mt-1 text-ui-sm text-accent1 hover:underline"
                  onClick={() => setMessageExpanded(v => !v)}
                >
                  {messageExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

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
            {log.metadata &&
              Object.entries(log.metadata)
                .filter(([, v]) => isSimpleMetadataValue(v))
                .map(([key, value]) => (
                  <Fragment key={key}>
                    <KV.Key>{key}</KV.Key>
                    <KV.Value>{String(value)}</KV.Value>
                  </Fragment>
                ))}
          </KV>

          {log.metadata &&
            Object.entries(log.metadata)
              .filter(([, v]) => !isSimpleMetadataValue(v))
              .map(([key, value]) => (
                <DataDetailsPanel.CodeSection
                  key={key}
                  title={key}
                  codeStr={metadataCodeStr(value)}
                  className="mt-3"
                />
              ))}

          {log.data && Object.keys(log.data).length > 0 && (
            <DataDetailsPanel.CodeSection title="Data" codeStr={JSON.stringify(log.data, null, 2)} className="mt-6" />
          )}
        </DataDetailsPanel.Content>
      )}
    </DataDetailsPanel>
  );
}
