import { Bell, Database, Radio } from 'lucide-react';

import { getNotificationMetadata, isRecord, isSignalData } from './signal-data';
import type { SignalData } from './signal-data';

export type SignalBadgeProps = {
  signal: unknown;
};

const contentsToText = (contents: unknown): string => {
  if (typeof contents === 'string') return contents;
  if (!Array.isArray(contents)) return '';

  return contents
    .map(part => {
      if (!isRecord(part)) return '';
      return part.type === 'text' && typeof part.text === 'string' ? part.text : '';
    })
    .filter(Boolean)
    .join('\n');
};

const formatValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const getStateLabel = (signal: SignalData) => {
  const state = isRecord(signal.metadata?.state) ? signal.metadata.state : undefined;
  return {
    id: formatValue(state?.id) ?? formatValue(signal.attributes?.id) ?? 'State signal',
    mode: formatValue(state?.mode) ?? formatValue(signal.attributes?.mode),
  };
};

const getNotificationTitle = (signal: SignalData) => {
  const notification = getNotificationMetadata(signal);
  if (notification?.signal === 'summary' || signal.tagName === 'notification-summary') return 'Notification summary';
  const source = notification?.source ?? formatValue(signal.attributes?.source);
  const kind = notification?.kind ?? formatValue(signal.attributes?.kind);
  if (source && kind) return `${source} / ${kind}`;
  return source ?? kind ?? 'Notification';
};

const getToneClass = (priority: string | undefined) => {
  switch (priority) {
    case 'urgent':
      return 'border-red-500/40 bg-red-500/10 text-red-200';
    case 'high':
      return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-100';
    case 'medium':
      return 'border-blue-500/40 bg-blue-500/10 text-blue-100';
    default:
      return 'border-border1 bg-surface2 text-neutral5';
  }
};

const Pill = ({ children }: { children: string }) => (
  <span className="inline-flex items-center rounded-full border border-border1 px-1.5 py-0.5 text-xs leading-none text-neutral4">
    {children}
  </span>
);

export const SignalBadge = ({ signal: value }: SignalBadgeProps) => {
  if (!isSignalData(value)) return null;

  const text = contentsToText(value.contents);

  if (value.type === 'state') {
    const state = getStateLabel(value);
    return (
      <div className="my-2 max-w-[80%] rounded-lg border border-border1 bg-surface2 px-4 py-3 text-neutral5">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-icon3" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">{state.id}</p>
              {state.mode ? <Pill>{state.mode}</Pill> : null}
            </div>
            {text ? <p className="mt-2 whitespace-pre-wrap break-words text-ui-sm leading-ui-md">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (value.type === 'notification') {
    const notification = getNotificationMetadata(value);
    const priority = notification?.priority ?? formatValue(value.attributes?.priority);
    const pending = formatValue(notification?.pending) ?? formatValue(value.attributes?.pending);
    const status = notification?.status ?? formatValue(value.attributes?.status);
    const toneClass = getToneClass(priority);

    return (
      <div className={`my-2 max-w-[80%] rounded-lg border px-4 py-3 ${toneClass}`}>
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">{getNotificationTitle(value)}</p>
              {priority ? <Pill>{priority}</Pill> : null}
              {status ? <Pill>{status}</Pill> : null}
              {pending ? <Pill>{`${pending} pending`}</Pill> : null}
            </div>
            {text ? <p className="mt-2 whitespace-pre-wrap break-words text-ui-sm leading-ui-md">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  if (value.type === 'reactive') {
    return (
      <div className="my-2 max-w-[80%] rounded-lg border border-border1 bg-surface2 px-4 py-3 text-neutral5">
        <div className="flex items-start gap-3">
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-icon3" />
          <div className="min-w-0 flex-1">
            <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">{value.tagName ?? 'Signal'}</p>
            {text ? <p className="mt-2 whitespace-pre-wrap break-words text-ui-sm leading-ui-md">{text}</p> : null}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
