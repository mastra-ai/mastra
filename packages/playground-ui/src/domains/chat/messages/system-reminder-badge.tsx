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
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <button
        type="button"
        onClick={() => setIsExpanded(value => !value)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-fill-subtle"
      >
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-column text-foreground">System reminder</p>
          <p className="mt-1 text-meta break-all text-muted-foreground">{title}</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isExpanded && reminder.body && (
        <div className="border-t border-border bg-sidebar px-4 py-3">
          <pre className="text-meta break-words whitespace-pre-wrap text-foreground">{reminder.body}</pre>
        </div>
      )}
    </div>
  );
};
