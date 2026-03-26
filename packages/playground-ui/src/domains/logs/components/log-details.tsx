import { format } from 'date-fns';
import { XIcon, CopyIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';
import type { LogRecord } from '../types';
import { LogsDataListLevelCell } from '@/ds/components/LogsDataList/logs-data-list-cells';
import { cn } from '@/lib/utils';

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button type="button" onClick={handleCopy} className="text-neutral2 hover:text-neutral5 transition-colors">
      {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
    </button>
  );
}

function DetailRow({ label, value, copyable }: { label: string; value?: string | null; copyable?: boolean }) {
  if (!value) return null;

  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border1">
      <span className="text-ui-xs uppercase tracking-widest text-neutral2 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-ui-sm text-neutral4 font-mono truncate">{value}</span>
        {copyable && <CopyButton text={value} />}
      </div>
    </div>
  );
}

export interface LogDetailsProps {
  log: LogRecord;
  onClose: () => void;
}

export function LogDetails({ log, onClose }: LogDetailsProps) {
  const date = toDate(log.timestamp);

  return (
    <div className="flex h-full flex-col border-l border-border1 bg-surface2">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border1 px-4 py-3">
        <div className="flex items-center gap-2">
          <LogsDataListLevelCell level={log.level} />
          <span className="text-ui-sm text-neutral3">{log.entityName}</span>
        </div>
        <button type="button" onClick={onClose} className="text-neutral2 hover:text-neutral5 transition-colors">
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Message */}
        <div className="mb-6">
          <p className="text-ui-xs uppercase tracking-widest text-neutral2 mb-2">Message</p>
          <p className="text-ui-sm text-neutral5 font-mono break-words whitespace-pre-wrap">
            {log.message}
          </p>
        </div>

        {/* Timestamp */}
        <div className="mb-6">
          <p className="text-ui-xs uppercase tracking-widest text-neutral2 mb-2">Timestamp</p>
          <p className="text-ui-sm text-neutral4 font-mono">
            {format(date, 'MMM dd, yyyy HH:mm:ss.SSS')}
          </p>
        </div>

        {/* Identifiers */}
        <div className="mb-6">
          <p className="text-ui-xs uppercase tracking-widest text-neutral2 mb-2">Identifiers</p>
          <DetailRow label="Trace ID" value={log.traceId} copyable />
          <DetailRow label="Span ID" value={log.spanId} copyable />
          <DetailRow label="Run ID" value={log.runId} copyable />
        </div>

        {/* Context */}
        <div className="mb-6">
          <p className="text-ui-xs uppercase tracking-widest text-neutral2 mb-2">Context</p>
          <DetailRow label="Entity Type" value={log.entityType} />
          <DetailRow label="Entity Name" value={log.entityName} />
          <DetailRow label="Service" value={log.serviceName} />
          <DetailRow label="Environment" value={log.environment} />
          <DetailRow label="Source" value={log.source} />
        </div>

        {/* Tags */}
        {log.tags && log.tags.length > 0 && (
          <div className="mb-6">
            <p className="text-ui-xs uppercase tracking-widest text-neutral2 mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {log.tags.map(tag => (
                <span key={tag} className="text-ui-xs text-neutral3 bg-surface3 border border-border1 rounded px-2 py-0.5">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {log.metadata && Object.keys(log.metadata).length > 0 && (
          <div className="mb-6">
            <p className="text-ui-xs uppercase tracking-widest text-neutral2 mb-2">Metadata</p>
            {Object.entries(log.metadata).map(([key, value]) => (
              <DetailRow key={key} label={key} value={String(value)} />
            ))}
          </div>
        )}

        {/* Data */}
        {log.data && Object.keys(log.data).length > 0 && (
          <div className="mb-6">
            <p className="text-ui-xs uppercase tracking-widest text-neutral2 mb-2">Data</p>
            <pre className="text-ui-xs text-neutral4 font-mono overflow-x-auto whitespace-pre-wrap break-words">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
