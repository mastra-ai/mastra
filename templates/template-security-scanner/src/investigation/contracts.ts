import { z } from 'zod';
import { idSchema, pathSchema, revisionSchema } from '../core/contracts.js';
import { categories } from '../knowledge/playbooks.js';
import { parseCron } from './schedule.js';

export const capabilityByCategory = {
  idor: 'check_idor',
  authentication_bypass: 'check_authentication',
  bfla: 'check_bfla',
  ssrf: 'check_owned_ssrf',
  misconfiguration: 'check_configuration',
  cors: 'check_cors',
  open_redirect: 'check_redirect',
  information_exposure: 'check_exposure',
} as const;

export const hypothesisRules = {
  activeRiskIffCategory: 'ssrf',
  pairedAdvisoryFields: ['advisoryId', 'advisoryRevision'],
  advisoryPresentIffOrigin: 'cve',
  unique: 'evidenceIds',
} as const;

export const hypothesisSchema = z
  .object({
    origin: z.enum(['playbook', 'novel', 'cve']),
    category: z.enum(categories),
    toolId: z.enum(Object.values(capabilityByCategory)),
    scanId: idSchema,
    evidenceIds: z.array(idSchema).min(1).max(8),
    referenceIds: z
      .array(z.string().regex(/^[A-Za-z0-9._-]{3,80}$/))
      .min(1)
      .max(8),
    advisoryId: z
      .string()
      .regex(/^CVE-\d{4}-\d{4,}$/)
      .optional(),
    advisoryRevision: revisionSchema.optional(),
    preconditions: z.array(z.string().regex(/^[a-z_]{3,50}$/)).max(8),
    expectedBehavior: z.string().min(8).max(300),
    risk: z.enum(['passive', 'active']),
    maxRequests: z.number().int().min(1).max(12),
    maxDurationSeconds: z.number().int().min(1).max(60),
    maxTokens: z.number().int().min(1).max(4096),
    maxRefinements: z.number().int().min(0).max(2),
  })
  .strict()
  .superRefine((value, context) => {
    if (capabilityByCategory[value.category] !== value.toolId)
      context.addIssue({ code: 'custom', message: 'The capability must match the category.' });
    if ((value.category === hypothesisRules.activeRiskIffCategory) !== (value.risk === 'active'))
      context.addIssue({ code: 'custom', message: 'Active risk must match the controlled SSRF capability.' });
    const [advisoryId, advisoryRevision] = hypothesisRules.pairedAdvisoryFields;
    if ((value[advisoryId] === undefined) !== (value[advisoryRevision] === undefined))
      context.addIssue({ code: 'custom', message: 'Advisory identity and revision must be paired.' });
    if ((value.origin === hypothesisRules.advisoryPresentIffOrigin) !== (value[advisoryId] !== undefined))
      context.addIssue({ code: 'custom', message: 'CVE provenance requires a current advisory.' });
    if (new Set(value[hypothesisRules.unique]).size !== value[hypothesisRules.unique].length)
      context.addIssue({ code: 'custom', message: 'Evidence IDs must be unique.' });
  });

export const investigationAdmissionSchema = z
  .object({
    scanId: idSchema,
    idempotencyKey: z
      .string()
      .min(16)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
    maxRequests: z.number().int().min(1).max(100),
    maxTokens: z.number().int().min(1).max(24576),
    maxDurationSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

export const approvalDecisionSchema = z
  .object({ decision: z.enum(['approved', 'denied']), revision: revisionSchema })
  .strict();

const ownedResourceBase = {
  path: pathSchema,
  marker: z.string().regex(/^LAB_MARKER_[A-Z0-9]{8,64}$/),
};
export const ownedResourceSchema = z.discriminatedUnion('category', [
  z
    .object({
      ...ownedResourceBase,
      category: z.literal('idor'),
      ownerProfileId: idSchema,
      alternateProfileId: idSchema,
    })
    .strict(),
  z
    .object({
      ...ownedResourceBase,
      category: z.literal('authentication_bypass'),
      authenticatedProfileId: idSchema,
      publicProfileId: idSchema,
    })
    .strict(),
  z
    .object({ ...ownedResourceBase, category: z.literal('bfla'), adminProfileId: idSchema, lowProfileId: idSchema })
    .strict(),
  z
    .object({
      category: z.literal('misconfiguration'),
      path: pathSchema,
      publicProfileId: idSchema,
      headerName: z.enum([
        'x-content-type-options',
        'x-frame-options',
        'referrer-policy',
        'strict-transport-security',
        'content-security-policy',
      ]),
      expectedValue: z
        .string()
        .min(1)
        .max(300)
        .regex(/^[\x20-\x7e]+$/),
    })
    .strict(),
  z
    .object({
      ...ownedResourceBase,
      category: z.literal('cors'),
      publicProfileId: idSchema,
    })
    .strict(),
  z
    .object({
      category: z.literal('open_redirect'),
      path: pathSchema,
      publicProfileId: idSchema,
      parameter: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      destination: z.literal('https://redirect.example.invalid/owned-destination'),
    })
    .strict(),
  z
    .object({
      ...ownedResourceBase,
      category: z.literal('information_exposure'),
      publicProfileId: idSchema,
      expectedAccess: z.literal('private'),
    })
    .strict(),
]);

export const scheduleSchema = z
  .object({
    targetId: idSchema,
    cron: z.string().refine(value => parseCron(value) !== null),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .refine(value => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }),
    enabled: z.boolean(),
  })
  .strict();

export type HypothesisInput = z.infer<typeof hypothesisSchema>;
export type InvestigationAdmission = z.infer<typeof investigationAdmissionSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type OwnedResourceInput = z.infer<typeof ownedResourceSchema>;
export type VerificationOutcome =
  | 'CONFIRMED'
  | 'NOT_REPRODUCED'
  | 'INCONCLUSIVE'
  | 'NOT_APPLICABLE'
  | 'PRECONDITION_MISSING'
  | 'AUTH_REQUIRED'
  | 'BLOCKED'
  | 'OUT_OF_SCOPE'
  | 'EXECUTION_ERROR';
