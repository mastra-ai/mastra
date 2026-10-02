import { boardCardStatus } from './boardCardStatus';
import type { BoardCardStatus, BoardCardStatusInput } from './boardCardStatus';

export type BoardCardActivity = 'idle' | 'moving' | 'starting' | 'retrying' | 'running' | 'awaiting';

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
  if (input.decision?.status === 'retry') return 'retrying';
  if (input.decision?.status === 'pending' || input.decision?.status === 'leased') return 'starting';
  return 'idle';
}

/** A request still handing off to the server, before a session owns the card. */
export function isCardActionPending(activity: BoardCardActivity): boolean {
  return activity === 'moving' || activity === 'starting' || activity === 'retrying';
}
