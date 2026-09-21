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
    <div className="border-border bg-background overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setIsExpanded(value => !value)}
        className="hover:bg-fill-subtle flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <FileText className="text-icon3 mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-column text-foreground">System reminder</p>
          <p className="text-meta text-muted-foreground mt-1 break-all">{title}</p>
        </div>
        {isExpanded ? (
          <ChevronDown className="text-icon3 size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-icon3 size-4 shrink-0" />
        )}
      </button>

      {isExpanded && reminder.body && (
        <div className="border-border bg-sidebar border-t px-4 py-3">
          <pre className="text-meta text-foreground font-mono break-words whitespace-pre-wrap">{reminder.body}</pre>
        </div>
      )}
    </div>
  );
};
