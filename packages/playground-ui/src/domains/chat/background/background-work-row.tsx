import type { ReactNode } from 'react';
import { RunningFor } from './running-for';
import {
  Activity,
  ActivityContent,
  ActivityHeadline,
  ActivityTrailing,
  ActivityTrigger,
} from '@/ds/components/ai/activity';
import { TaskListStatusIcon } from '@/ds/components/ai/task-list';

export interface BackgroundWorkRowProps {
  icon: ReactNode;
  label: string;
  detail?: string;
  /** Epoch milliseconds the work started on the server; the elapsed time is hidden without it. */
  startedAt?: number;
  /** Control that stops the work; omitted for work that can't be stopped. */
  stop?: ReactNode;
  /** The expanded body, mounted only while the row is open. */
  children: ReactNode;
}

/** One running piece of background work in the dock: what it is, how long it has run, its output. */
export function BackgroundWorkRow({ icon, label, detail, startedAt, stop, children }: BackgroundWorkRowProps) {
  return (
    <li>
      <Activity aria-label={detail ? `${label}: ${detail}` : label}>
        <div className="flex w-full min-w-0 items-center">
          <ActivityTrigger className="min-w-0 flex-1">
            <ActivityHeadline
              leading={<TaskListStatusIcon status="in_progress" />}
              icon={icon}
              label={label}
              detail={detail}
            />
          </ActivityTrigger>
          <ActivityTrailing className="gap-1 pr-1">
            {startedAt !== undefined && <RunningFor startedAt={startedAt} />}
            {/* Holds the stop button's place so elapsed times line up across rows. */}
            {stop ?? <span aria-hidden className="size-control-sm shrink-0" />}
          </ActivityTrailing>
        </div>
        <ActivityContent>{children}</ActivityContent>
      </Activity>
    </li>
  );
}
