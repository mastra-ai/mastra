import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseSystemReminder } from './system-reminder-utils';

export interface SystemReminderBadgeProps {
  text: string;
}

export const SystemReminderBadge = ({ text }: SystemReminderBadgeProps) => {
  const reminder = useMemo(() => parseSystemReminder(text), [text]);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reminder) {
    return text;
  }

  const title = reminder.path || reminder.type || 'System reminder';

  return (
    <div className="rounded-lg border border-border1 bg-surface2 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(value => !value)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface3 transition-colors"
      >
        <FileText className="w-4 h-4 text-icon3 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">System reminder</p>
          <p className="text-ui-xs leading-ui-xs text-neutral4 break-all mt-1">{title}</p>
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
