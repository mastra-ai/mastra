import { z } from 'zod';

import { opaqueId, sha256, utcTimestamp } from '../schemas/common.js';
import { ContainmentActionTypeSchema } from '../schemas/containment.js';
import { IncidentSeveritySchema, IncidentStatusSchema } from '../schemas/incident.js';

export const ExternalIncidentProjectionSchema = z
  .object({
    incidentId: opaqueId,
    tenantId: opaqueId,
    kind: z.enum(['unauthorized_privilege_change', 'disallowed_country_login', 'unknown_device_login']),
    severity: IncidentSeveritySchema,
    status: IncidentStatusSchema,
    occurredAt: utcTimestamp,
    summaryCode: z.enum([
      'PRIVILEGE_CHANGE_REQUIRES_REVIEW',
      'COUNTRY_LOGIN_REQUIRES_REVIEW',
      'UNKNOWN_DEVICE_REQUIRES_REVIEW',
      'CONTAINMENT_REJECTED',
      'CONTAINMENT_SUCCEEDED',
      'CONTAINMENT_FAILED',
    ]),
    planHashVersion: z.literal(1),
    planHash: sha256,
    actionTypes: z.array(ContainmentActionTypeSchema).min(1).max(2),
  })
  .strict();

export type ExternalIncidentProjection = z.infer<typeof ExternalIncidentProjectionSchema>;

export const ExternalIncidentResultSchema = z
  .object({
    // A provider reference is an opaque identifier, never a URL. Keeping the
    // provider prefix closed prevents a Linear create from being rejected by
    // the authoritative delivery boundary after the remote effect happened.
    externalRef: z.string().regex(/^(?:local-incident-[a-f0-9]{16}|linear:[A-Za-z0-9_-]{1,120})$/u),
  })
  .strict();

export type ExternalIncidentResult = z.infer<typeof ExternalIncidentResultSchema>;

export class ExternalIncidentSupersededError extends Error {}

export interface IncidentProvider {
  readonly providerId?: 'local-incident' | 'linear' | 'disabled';
  create(input: {
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult>;
  update(input: {
    externalRef: string;
    projection: ExternalIncidentProjection;
    idempotencyKey: string;
    generation: number;
  }): Promise<ExternalIncidentResult>;
  /**
   * A timeout after a non-idempotent create is uncertain, never a permission
   * to create again. Providers that can search their authoritative marker
   * implement this bounded reconciliation hook.
   */
  reconcile?(input: {
    operation: 'create' | 'update';
    idempotencyKey: string;
    externalRef?: string;
    generation?: number;
    /** The authoritative projection expected to be visible after an update. */
    projection?: ExternalIncidentProjection;
  }): Promise<ExternalIncidentResult | undefined>;
}
