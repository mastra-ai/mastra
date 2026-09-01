import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentProps } from 'react';

import './sessionActivity.css';

/**
 * Session lifecycle states surfaced by the activity markers. The color scheme
 * mirrors `SessionFavicon` so the sidebar and the tab-favicon read the same
 * way at a glance.
 */
export type SessionRowStatus = 'initializing' | 'working' | 'ready';

/**
 * A board card also has to say "bound but nothing to report". Rows hide their
 * belt instead, so `ready` keeps one meaning everywhere — it is your turn.
 */
export type SessionCardStatus = SessionRowStatus | 'idle';

const PILLS = [0, 1, 2, 3, 4];

const PENTAD = [0, 72, 144, 216, 288];

const STATUS_TITLE: Record<SessionCardStatus, string> = {
  initializing: 'Initializing',
  working: 'Working',
  ready: 'Ready',
  idle: 'Idle',
};

function statusAttributes(status: SessionCardStatus, label: string | undefined) {
  return label ? { role: 'status', 'aria-label': label, title: STATUS_TITLE[status] } : { 'aria-hidden': true };
}

/**
 * The sidebar row's left rail: pills travelling down it while the agent works,
 * the same pills breathing in place once it is your turn. One clock for both,
 * so a session that finishes its turn morphs rather than swapping markers.
 */
export function SessionActivityBelt({
  status,
  label,
  className,
  ...props
}: ComponentProps<'span'> & {
  status: SessionRowStatus;
  /** Omit where the status is already spelled out in adjacent text: the marker is then decorative. */
  label?: string;
}) {
  return (
    <span
      {...props}
      {...statusAttributes(status, label)}
      className={cn('session-belt', `session-${status}`, className)}
    >
      <span className="session-belt-sway">
        <span className="session-belt-jam">
          {PILLS.map(pill => (
            <i key={pill} />
          ))}
        </span>
      </span>
    </span>
  );
}

/**
 * The card's marker: five on a ring, swelling in turn while the agent works,
 * stuttering round while the sandbox is still coming up, and settling into an
 * even ring with a slow wave once it is your turn.
 */
export function SessionActivityPentad({
  status,
  label,
  className,
  ...props
}: ComponentProps<'svg'> & {
  status: SessionCardStatus;
  /** Omit where the status is already spelled out in adjacent text: the marker is then decorative. */
  label?: string;
}) {
  return (
    <svg
      {...props}
      {...statusAttributes(status, label)}
      viewBox="0 0 24 24"
      className={cn('session-pentad', `session-${status}`, className)}
    >
      {PENTAD.map(angle => (
        <g key={angle} style={{ transform: `rotate(${angle}deg)` }}>
          <circle cx="12" cy="5.4" r="2.8" />
        </g>
      ))}
    </svg>
  );
}
