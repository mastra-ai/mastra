import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type ActivityStatus = 'initializing' | 'working' | 'ready';

import './activity.css';

const PILLS = [0, 1, 2, 3, 4];

const STATUS_TITLE: Record<ActivityStatus, string> = {
  initializing: 'Initializing',
  working: 'Working',
  ready: 'Waiting on you',
};

function statusAttributes(status: ActivityStatus, label: string | undefined) {
  return label ? { role: 'status', 'aria-label': label, title: STATUS_TITLE[status] } : { 'aria-hidden': true };
}

export function ActivityBelt({
  status,
  label,
  className,
  ...props
}: ComponentProps<'span'> & {
  status: ActivityStatus;
  label?: string;
}) {
  return (
    <span
      {...props}
      {...statusAttributes(status, label)}
      className={cn('session-belt', `session-${status}`, className)}
    >
      <span className="session-belt-sway">
        {PILLS.map(pill => (
          <i key={pill} />
        ))}
      </span>
    </span>
  );
}

export function ActivityWick({
  status,
  label,
  className,
  ...props
}: ComponentProps<'span'> & {
  status: ActivityStatus;
  label?: string;
}) {
  return (
    <span
      {...props}
      data-live-session-indicator={status}
      role="status"
      aria-label={label ?? STATUS_TITLE[status]}
      title={STATUS_TITLE[status]}
      className={cn('session-wick', `session-${status}`, className)}
    />
  );
}
