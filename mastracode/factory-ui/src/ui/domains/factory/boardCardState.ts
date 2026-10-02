import { boardCardStatus, retriesAfterFailure } from './boardCardStatus';
import type { BoardCardStatus, BoardCardStatusInput } from './boardCardStatus';

/** A request still handing off to the server, before a session owns the card, and the label its button wears. */
export const PENDING_ACTION_LABEL = { moving: 'Moving…', starting: 'Starting…', retrying: 'Retrying…' } as const;

type PendingCardActivity = keyof typeof PENDING_ACTION_LABEL;

export type BoardCardActivity = 'idle' | PendingCardActivity | 'running' | 'awaiting';

export interface BoardCardState {
  status: BoardCardStatus;
  activity: BoardCardActivity;
}

interface BoardCardStateInput extends BoardCardStatusInput {
  /** The user's retry request has not yet been reflected in the decision query. */
  retrying?: boolean;
}

/**
 * Status copy and available actions share the same facts. A queued effect owns
 * the card before it has a session, and an automatic retry still owns it even
 * though its status row describes an error.
 */
export function boardCardState(input: BoardCardStateInput): BoardCardState {
  return {
    status: boardCardStatus({ ...input, preparing: input.preparing ?? (input.retrying ? 'Retrying…' : undefined) }),
    activity: cardActivity(input),
  };
}

function cardActivity(input: BoardCardStateInput): BoardCardActivity {
  if (input.moving !== undefined) return 'moving';
  if (input.preparing !== undefined) return 'starting';
  if (input.retrying) return 'retrying';
  if (input.sessionStatus === 'initializing' || input.sessionStatus === 'working') return 'running';
  // A session parked on a tool still owns the branch until a person answers it.
  if (input.sessionStatus === 'ready') return 'awaiting';
  if (input.decision !== undefined && retriesAfterFailure(input.decision)) return 'retrying';
  if (input.decision?.status === 'pending' || input.decision?.status === 'leased' || input.decision?.status === 'retry')
    return 'starting';
  return 'idle';
}

export function isCardActionPending(activity: BoardCardActivity): activity is PendingCardActivity {
  return Object.hasOwn(PENDING_ACTION_LABEL, activity);
}
