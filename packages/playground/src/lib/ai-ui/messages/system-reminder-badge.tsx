import { BellRing, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseSystemReminder } from './system-reminder-utils';

/**
 * Structured signal data the badge can render directly without parsing XML.
 * Mirrors the `metadata.signal` shape that lands on `MastraUIMessage.metadata`
 * for `role: 'signal'` messages (see `signalToDBMessage`).
 */
export interface SystemReminderSignal {
  type?: string;
  body: string;
  attributes?: Record<string, unknown>;
  /** When present, render a heartbeat indicator alongside the badge label. */
  heartbeat?: { scheduleId?: string; broadcast?: string; threadId?: string };
}

export interface SystemReminderBadgeProps {
  /** Inline `<system-reminder>` XML payload (legacy user-typed flow). */
  text?: string;
  /** Structured signal data (preferred — historical signal messages). */
  signal?: SystemReminderSignal;
}

export const SystemReminderBadge = ({ text, signal }: SystemReminderBadgeProps) => {
  const reminder = useMemo(() => {
    if (signal) {
      return {
        title:
          (typeof signal.attributes?.path === 'string' ? signal.attributes.path : undefined) ??
          signal.type ??
          'System reminder',
        body: signal.body,
        heartbeat: signal.heartbeat,
      };
    }
    if (text === undefined) return null;
    const parsed = parseSystemReminder(text);
    if (!parsed) return null;
    return {
      title: parsed.path || parsed.type || 'System reminder',
      body: parsed.body,
      heartbeat: undefined as SystemReminderSignal['heartbeat'],
    };
  }, [text, signal]);

  const [isExpanded, setIsExpanded] = useState(false);

  if (!reminder) {
    return text ?? '';
  }

  return (
    <div className="rounded-lg border border-border1 bg-surface2 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(value => !value)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface3 transition-colors"
      >
        <FileText className="w-4 h-4 text-icon3 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">System reminder</p>
            {reminder.heartbeat ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface3 px-2 py-0.5 text-ui-xs leading-ui-xs text-neutral5">
                <BellRing className="w-3 h-3" />
                heartbeat
              </span>
            ) : null}
          </div>
          <p className="text-ui-xs leading-ui-xs text-neutral4 break-all mt-1">{reminder.title}</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-icon3 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-icon3 shrink-0" />
        )}
      </button>

      {isExpanded && reminder.body && (
        <div className="border-t border-border1 px-4 py-3 bg-surface1">
          <pre className="whitespace-pre-wrap break-words text-ui-xs leading-ui-md text-neutral5 font-mono">
            {reminder.body}
          </pre>
        </div>
      )}
    </div>
  );
};
