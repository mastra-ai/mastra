import { z } from 'zod';

import {
  actorIdSchema,
  correlationIdSchema,
  policyIdSchema,
  semanticVersionSchema,
  tenantIdSchema,
} from './identifiers.js';

export const piiModeSchema = z.enum(['demo-default', 'demo-strict']);
export const actorTypeSchema = z.enum(['applicant', 'reviewer', 'system', 'webhook']);

export const actorSchema = z
  .object({
    type: actorTypeSchema,
    id: actorIdSchema,
    roles: z.array(z.string().min(1).max(64)).default([]),
  })
  .strict();

export const policyReferenceSchema = z
  .object({
    id: policyIdSchema,
    version: semanticVersionSchema,
    checksum: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

export const executionContextSchema = z
  .object({
    tenantId: tenantIdSchema,
    jurisdiction: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/u),
    piiMode: piiModeSchema,
    policy: policyReferenceSchema,
    locale: z.string().min(2).max(35),
    correlationId: correlationIdSchema,
    actor: actorSchema,
  })
  .strict();

export type PiiMode = z.infer<typeof piiModeSchema>;
export type Actor = z.infer<typeof actorSchema>;
export type PolicyReference = z.infer<typeof policyReferenceSchema>;
export type ExecutionContext = z.infer<typeof executionContextSchema>;
