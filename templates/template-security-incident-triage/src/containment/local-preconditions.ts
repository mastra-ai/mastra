import { DomainError } from '../domain/errors.js';
import type { ContainmentAction } from '../schemas/containment.js';
import type { LocalContainmentState } from './local-state.js';

export class LocalPreconditionError extends Error {}

export function assertLocalPrecondition(state: LocalContainmentState, action: ContainmentAction): void {
  if (action.type === 'revoke_session') {
    const current = state.sessions.get(action.targetId);
    if (current !== undefined && current !== 'active' && current !== 'revoked') throw new LocalPreconditionError();
    return;
  }
  if (action.type === 'restore_previous_role') {
    const role = action.input.role;
    if (role !== 'member' && role !== 'viewer') fail();
    const current = state.roles.get(action.targetId);
    if (current !== undefined && current !== 'admin' && current !== role) throw new LocalPreconditionError();
    return;
  }
  if (action.type === 'mark_device_for_review') {
    if (action.input.reviewState !== 'pending') fail();
    const current = state.devices.get(action.targetId);
    if (current !== undefined && current !== 'clear' && current !== 'pending') throw new LocalPreconditionError();
    return;
  }
  const sessionId = action.input.sessionId;
  if (typeof sessionId !== 'string') fail();
  const current = state.reauthentication.get(action.targetId);
  if (current !== undefined && current !== sessionId) throw new LocalPreconditionError();
}

function fail(): never {
  throw new DomainError('VALIDATION_FAILED');
}
