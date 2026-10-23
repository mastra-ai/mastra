import { DomainError, parseDomainSchema } from './errors.js';
import { IncidentStatusSchema, type IncidentStatus } from '../schemas/incident.js';

export const incidentTransitions = {
  received: ['investigating', 'failed'],
  investigating: ['awaiting_approval', 'failed', 'closed'],
  awaiting_approval: ['approved', 'rejected', 'failed'],
  approved: ['containing', 'failed'],
  rejected: ['closed'],
  containing: ['contained', 'failed'],
  contained: ['closed'],
  failed: ['investigating', 'containing', 'closed'],
  closed: [],
} as const satisfies Record<IncidentStatus, readonly IncidentStatus[]>;

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  const parsedFrom = parseDomainSchema(IncidentStatusSchema, from);
  const parsedTo = parseDomainSchema(IncidentStatusSchema, to);
  return (incidentTransitions[parsedFrom] as readonly IncidentStatus[]).includes(parsedTo);
}

export function assertTransition(from: IncidentStatus, to: IncidentStatus): void {
  if (!canTransition(from, to)) {
    throw new DomainError('INVALID_TRANSITION');
  }
}
