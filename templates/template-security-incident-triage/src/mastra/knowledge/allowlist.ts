import { ContainmentActionTypeSchema, type ContainmentActionType } from '../../schemas/containment.js';
import type { IncidentKind } from '../../schemas/incident.js';
import { RunbookError } from './errors.js';

const expectedActions: Readonly<Record<IncidentKind, readonly ContainmentActionType[]>> = {
  unauthorized_privilege_change: ['restore_previous_role', 'revoke_session'],
  disallowed_country_login: ['revoke_session', 'require_reauthentication'],
  unknown_device_login: ['revoke_session', 'mark_device_for_review'],
};

export function validatePersistedAllowedActions(kind: IncidentKind, value: string): readonly ContainmentActionType[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new RunbookError('RUNBOOK_ACTION_NOT_ALLOWLISTED');
  }
  if (!Array.isArray(parsed)) throw new RunbookError('RUNBOOK_ACTION_NOT_ALLOWLISTED');
  const actions = parsed.map(action => {
    const result = ContainmentActionTypeSchema.safeParse(action);
    if (!result.success) throw new RunbookError('RUNBOOK_ACTION_NOT_ALLOWLISTED');
    return result.data;
  });
  if (actions.join('\0') !== expectedActions[kind].join('\0')) {
    throw new RunbookError('RUNBOOK_ACTION_NOT_ALLOWLISTED');
  }
  return Object.freeze(actions);
}
