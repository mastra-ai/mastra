import { cn } from '@mastra/playground-ui/utils/cn';
import type { ComponentProps } from 'react';

import type { SessionRowStatus } from '../services/sessionStatus';

import './sessionActivity.css';

const PILLS = [0, 1, 2, 3, 4];

const PENTAD = [0, 72, 144, 216, 288];

const STATUS_TITLE: Record<SessionRowStatus, string> = {
  initializing: 'Initializing',
  working: 'Working',
  ready: 'Ready',
};

function statusAttributes(status: SessionRowStatus, label: string | undefined) {
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
        {PILLS.map(pill => (
          <i key={pill} />
        ))}
      </span>
    </span>
  );
}

/**
 * The card's marker: a lit head running the card's own outline, dragging a long
 * decaying tail. It runs in the setup hue while the sandbox comes up, and the
 * rim comes up lit under it once it is your turn. A bound session with nothing
 * to report gets no wick — the card shows its Open session button instead.
 * Nothing on the card spells the state out, so it always announces. It paints
 * the card's own 1px border, taking its radius from it: the card has to be
 * `relative`, hand that border over (`border-transparent`) and not clip its
 * own paint.
 */
export function SessionActivityWick({
  status,
  label,
  className,
  ...props
}: ComponentProps<'span'> & {
  status: SessionRowStatus;
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

/**
 * The inline marker, for a header row where there is no outline to run: five on
 * a ring, swelling in turn while the agent works — in the setup hue while the
 * sandbox is still coming up — and settling into an even ring with a slow wave
 * once it is your turn.
 */
export function SessionActivityPentad({
  status,
  label,
  className,
  ...props
}: ComponentProps<'svg'> & {
  status: SessionRowStatus;
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
