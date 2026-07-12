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
    <div className="overflow-hidden rounded-lg border border-border1 bg-surface2">
      <button
        type="button"
        onClick={() => setIsExpanded(value => !value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface3"
      >
        <FileText className="text-icon3 mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-ui-sm leading-ui-sm font-medium text-neutral6">System reminder</p>
          <p className="mt-1 text-ui-xs leading-ui-xs break-all text-neutral4">{title}</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="text-icon3 size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-icon3 size-4 shrink-0" />
        )}
      </button>

      {isExpanded && reminder.body && (
        <div className="border-t border-border1 bg-surface1 px-4 py-3">
          <pre className="font-mono text-ui-xs leading-ui-md break-words whitespace-pre-wrap text-neutral5">
            {reminder.body}
          </pre>
        </div>
      )}
    </div>
  );
};
