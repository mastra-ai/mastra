import type { OperationalStore } from '../db/operational-store.js';
import { DomainError } from '../domain/errors.js';
import { ContainmentActionOutcomeSchema } from '../schemas/containment.js';
import type { GatewayActionInput } from './gateway-authorization.js';

export async function readContainmentOutcome(store: OperationalStore, input: GatewayActionInput) {
  const result = await store.execute({
    sql: `SELECT status, verification, provider_ref, error_code
      FROM containment_action_attempts
      WHERE tenant_id = ? AND plan_id = ? AND action_id = ?
      ORDER BY attempt DESC LIMIT 1`,
    args: [input.tenantId, input.plan.planId, input.action.actionId],
  });
  const row = result.rows[0];
  if (!row) throw new DomainError('VALIDATION_FAILED');
  return ContainmentActionOutcomeSchema.parse({
    actionId: input.action.actionId,
    status: row.status,
    verification: row.verification,
    ...(row.provider_ref ? { providerRef: row.provider_ref } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
  });
}
