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

/** Validated hypothesis contract; bounds and cross-field rules are enforced before use. */
export const hypothesisSchema = z
  .object({
    /** Hypothesis provenance: local playbook, novel proposal, or current CVE. */
    origin: z.enum(['playbook', 'novel', 'cve']),
    /** Discriminator selecting the vulnerability category and its typed facts. */
    category: z.enum(categories),
    /** Allowlisted capability identifier; must match the selected category. */
    toolId: z.enum(Object.values(capabilityByCategory)),
    /** Discovery scan supplying the source inventory. */
    scanId: idSchema,
    /** Source evidence identifiers grounding the hypothesis or result. */
    evidenceIds: z.array(idSchema).min(1).max(8),
    /** Pinned local security references grounding the hypothesis. */
    referenceIds: z
      .array(z.string().regex(/^[A-Za-z0-9._-]{3,80}$/))
      .min(1)
      .max(8),
    /** Current advisory identifier; required together with advisoryRevision for CVE hypotheses. */
    advisoryId: z
      .string()
      .regex(/^CVE-\d{4}-\d{4,}$/)
      .optional(),
    /** Exact material advisory revision grounding the hypothesis. */
    advisoryRevision: revisionSchema.optional(),
    /** Bounded precondition identifiers; trusted code independently rechecks them. */
    preconditions: z.array(z.string().regex(/^[a-z_]{3,50}$/)).max(8),
    /** Expected policy behavior; it cannot override deterministic confirmation. */
    expectedBehavior: z.string().min(8).max(300),
    /** Passive or active classification; SSRF is the active capability. */
    risk: z.enum(['passive', 'active']),
    /** Maximum upstream requests allowed; reservations are shared and not refunded. */
    maxRequests: z.number().int().min(1).max(12),
    /** Maximum elapsed duration in seconds. */
    maxDurationSeconds: z.number().int().min(1).max(60),
    /** Requested per-hypothesis allowance checked at admission; runtime uses the shared investigation ledger. */
    maxTokens: z.number().int().min(1).max(4096),
    /** Requested refinement ceiling; this runtime does not run a refinement loop. */
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

/** Validated investigation admission contract; bounds and cross-field rules are enforced before use. */
export const investigationAdmissionSchema = z
  .object({
    /** Discovery scan supplying the source inventory. */
    scanId: idSchema,
    /** Caller-selected stable key; repeated input returns the existing admission. */
    idempotencyKey: z
      .string()
      .min(16)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/),
    /** Maximum upstream requests allowed; reservations are shared and not refunded. */
    maxRequests: z.number().int().min(1).max(100),
    /** Explicit shared investigation token allowance, from 1 through 24576. */
    maxTokens: z.number().int().min(1).max(24576),
    /** Maximum elapsed duration in seconds. */
    maxDurationSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

/** Validated approval decision contract; bounds and cross-field rules are enforced before use. */
export const approvalDecisionSchema = z
  .object({
    /** Approval state or operator decision, as selected by this contract. */
    decision: z.enum(['approved', 'denied']),
    /** Current optimistic-concurrency revision; stale writes are rejected. */
    revision: revisionSchema,
  })
  .strict();

const ownedResourceBase = {
  /** Canonical scoped path without query values or fragments. */
  path: pathSchema,
  /** Registered owned-lab marker used only by deterministic verification. */
  marker: z.string().regex(/^LAB_MARKER_[A-Z0-9]{8,64}$/),
};
/** Validated owned resource contract; bounds and cross-field rules are enforced before use. */
export const ownedResourceSchema = z.discriminatedUnion('category', [
  z
    .object({
      ...ownedResourceBase,
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('idor'),
      /** Authenticated profile owning the comparison resource. */
      ownerProfileId: idSchema,
      /** Different authenticated profile used for cross-owner comparison. */
      alternateProfileId: idSchema,
    })
    .strict(),
  z
    .object({
      ...ownedResourceBase,
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('authentication_bypass'),
      /** Authenticated profile proving the protected resource exists. */
      authenticatedProfileId: idSchema,
      /** Public profile used for the comparison. */
      publicProfileId: idSchema,
    })
    .strict(),
  z
    .object({
      ...ownedResourceBase,
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('bfla'),
      /** Administrative profile proving the protected function exists. */
      adminProfileId: idSchema,
      /** Lower-privilege authenticated profile used for comparison. */
      lowProfileId: idSchema,
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('misconfiguration'),
      /** Canonical scoped path without query values or fragments. */
      path: pathSchema,
      /** Public profile used for the comparison. */
      publicProfileId: idSchema,
      /** Allowlisted security response header evaluated by the configuration check. */
      headerName: z.enum([
        'x-content-type-options',
        'x-frame-options',
        'referrer-policy',
        'strict-transport-security',
        'content-security-policy',
      ]),
      /** Registered safe value expected by the configuration check. */
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
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('cors'),
      /** Public profile used for the comparison. */
      publicProfileId: idSchema,
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('open_redirect'),
      /** Canonical scoped path without query values or fragments. */
      path: pathSchema,
      /** Public profile used for the comparison. */
      publicProfileId: idSchema,
      /** Registered redirect parameter name. */
      parameter: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      /** Fixed owned redirect destination; the verifier does not follow it. */
      destination: z.literal('https://redirect.example.invalid/owned-destination'),
    })
    .strict(),
  z
    .object({
      ...ownedResourceBase,
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('information_exposure'),
      /** Public profile used for the comparison. */
      publicProfileId: idSchema,
      /** Registered private access expectation for the owned resource. */
      expectedAccess: z.literal('private'),
    })
    .strict(),
]);

/** Validated schedule contract; bounds and cross-field rules are enforced before use. */
export const scheduleSchema = z
  .object({
    /** Authorized target to which this record belongs. */
    targetId: idSchema,
    /** Five-field cron using a wildcard or one integer per field. */
    cron: z.string().refine(value => parseCron(value) !== null),
    /** IANA timezone used to calculate scheduled occurrences. */
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
    /** Whether this feature is explicitly enabled. */
    enabled: z.boolean(),
  })
  .strict();

/** Grounded category/capability proposal with finite budgets and current references. */
export type HypothesisInput = z.infer<typeof hypothesisSchema>;
/** Explicit admission budgets for one completed source scan. */
export type InvestigationAdmission = z.infer<typeof investigationAdmissionSchema>;
/** Opt-in recurrence with a five-field cron and explicit IANA timezone. */
export type ScheduleInput = z.infer<typeof scheduleSchema>;
/** Category-specific owned-lab resource and identity requirements. */
export type OwnedResourceInput = z.infer<typeof ownedResourceSchema>;
/** Verification states distinguishing confirmed, negative, incomplete, and blocked work. */
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
