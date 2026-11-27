import { z } from 'zod';
import { createHash } from 'node:crypto';
import { ControlPlaneError, parse } from '../core/contracts.js';
import { ReferenceCatalog } from './catalog.js';

export const categories = [
  'idor',
  'authentication_bypass',
  'bfla',
  'ssrf',
  'misconfiguration',
  'cors',
  'open_redirect',
  'information_exposure',
] as const;
export type Category = (typeof categories)[number];
export type Outcome =
  | 'CONFIRMED'
  | 'NOT_REPRODUCED'
  | 'INCONCLUSIVE'
  | 'NOT_APPLICABLE'
  | 'PRECONDITION_MISSING'
  | 'AUTH_REQUIRED'
  | 'BLOCKED'
  | 'OUT_OF_SCOPE'
  | 'EXECUTION_ERROR';

const limits = z
  .object({
    /** Maximum execution attempts allowed by this playbook. */
    maxAttempts: z.number().int().min(1).max(4),
    /** Maximum upstream requests allowed; reservations are shared and not refunded. */
    maxRequests: z.number().int().min(1).max(12),
    /** Maximum elapsed duration in seconds. */
    maxDurationSeconds: z.number().int().min(1).max(60),
  })
  .strict();
const registeredTools = {
  check_idor: 'idor',
  check_authentication: 'authentication_bypass',
  check_bfla: 'bfla',
  check_owned_ssrf: 'ssrf',
  check_configuration: 'misconfiguration',
  check_cors: 'cors',
  check_redirect: 'open_redirect',
  check_exposure: 'information_exposure',
} as const;
const playbookSchema = z
  .object({
    /** Playbook contract version. */
    version: z.literal(1),
    /** Discriminator selecting the vulnerability category and its typed facts. */
    category: z.enum(categories),
    /** Allowlisted capability identifier; must match the selected category. */
    toolId: z.enum(Object.keys(registeredTools) as [keyof typeof registeredTools, ...(keyof typeof registeredTools)[]]),
    /** Pinned local catalog reference IDs required by this playbook. */
    references: z.array(z.string().min(3)).min(2).max(8),
    /** Capability roles that must be bound before execution. */
    requiredRoles: z.array(z.string()).max(2),
    /** Owned resources required before this capability may execute. */
    requiredResources: z.array(z.string()).max(3),
    /** Evidence kinds required for deterministic confirmation. */
    requiredEvidence: z.array(z.string()).min(1).max(6),
    /** Expected policy behavior; it cannot override deterministic confirmation. */
    expectedBehavior: z.string().min(10).max(400),
    /** Whether a current exact operator approval is required. */
    approvalRequired: z.boolean(),
    /** Explicit finite budgets recorded for this operation. */
    limits,
  })
  .strict()
  .refine(value => registeredTools[value.toolId] === value.category);
/** Versioned capability prerequisites, references, evidence rules, and budgets. */
export type Playbook = z.infer<typeof playbookSchema>;
/** Integrity snapshot of the selected playbook and offline reference catalog. */
export type PlaybookBinding = {
  /** SHA-256 binding to the verified offline reference manifest. */
  catalogDigest: string;
  /** Category identifier of the selected playbook. */
  playbookId: Category;
  /** Version of the selected playbook contract. */
  playbookVersion: number;
  /** SHA-256 binding to the reviewed playbook content. */
  playbookDigest: string;
};

const bounds = { maxAttempts: 2, maxRequests: 6, maxDurationSeconds: 30 };
const definitions: Playbook[] = [
  {
    version: 1,
    category: 'idor',
    toolId: 'check_idor',
    references: ['WSTG-ATHZ-04', 'v5.0.0-V8.2.2', 'CWE-639'],
    requiredRoles: ['owner', 'alternate'],
    requiredResources: ['owned-read-only-resource'],
    requiredEvidence: ['owner response', 'alternate response'],
    expectedBehavior: 'An alternate identity cannot read the owner resource.',
    approvalRequired: false,
    limits: bounds,
  },
  {
    version: 1,
    category: 'authentication_bypass',
    toolId: 'check_authentication',
    references: ['WSTG-ATHN-04', 'v5.0.0-V6.3.4', 'CWE-287'],
    requiredRoles: ['authenticated', 'public'],
    requiredResources: ['protected-read-only-resource'],
    requiredEvidence: ['authenticated baseline', 'public response', 'invalid-session response'],
    expectedBehavior: 'Public and invalid sessions cannot read the protected resource.',
    approvalRequired: false,
    limits: bounds,
  },
  {
    version: 1,
    category: 'bfla',
    toolId: 'check_bfla',
    references: ['WSTG-ATHZ-03', 'v5.0.0-V8.1.1', 'CWE-862', 'CAPEC-1'],
    requiredRoles: ['admin', 'low'],
    requiredResources: ['read-only-admin-function'],
    requiredEvidence: ['admin response', 'low-role response'],
    expectedBehavior: 'A low role cannot access an admin-only function.',
    approvalRequired: false,
    limits: bounds,
  },
  {
    version: 1,
    category: 'ssrf',
    toolId: 'check_owned_ssrf',
    references: ['WSTG-INPV-19', 'v5.0.0-V1.3.6', 'CWE-918', 'CAPEC-664'],
    requiredRoles: [],
    requiredResources: ['owned-callback', 'recorded-approval'],
    requiredEvidence: ['callback counter', 'approval binding'],
    expectedBehavior:
      'The authorized owned callback receives a request only when the target follows the submitted URL.',
    approvalRequired: true,
    limits: { maxAttempts: 1, maxRequests: 2, maxDurationSeconds: 15 },
  },
  {
    version: 1,
    category: 'misconfiguration',
    toolId: 'check_configuration',
    references: ['WSTG-CONF-07', 'v5.0.0-V3.4.1'],
    requiredRoles: [],
    requiredResources: ['documented-header-expectation'],
    requiredEvidence: ['observed header'],
    expectedBehavior: 'The documented security header matches its expected value.',
    approvalRequired: false,
    limits: bounds,
  },
  {
    version: 1,
    category: 'cors',
    toolId: 'check_cors',
    references: ['WSTG-CLNT-07', 'v5.0.0-V3.4.2', 'CWE-942'],
    requiredRoles: ['browser'],
    requiredResources: ['harmless-sensitive-fixture'],
    requiredEvidence: ['browser cross-origin read'],
    expectedBehavior: 'A disallowed cross-origin browser cannot read the sensitive fixture.',
    approvalRequired: false,
    limits: bounds,
  },
  {
    version: 1,
    category: 'open_redirect',
    toolId: 'check_redirect',
    references: ['WSTG-CLNT-04', 'v5.0.0-V3.7.2', 'CWE-601'],
    requiredRoles: [],
    requiredResources: ['controlled-redirect-parameter'],
    requiredEvidence: ['Location header'],
    expectedBehavior: 'The controlled parameter cannot direct the browser outside the approved origin.',
    approvalRequired: false,
    limits: bounds,
  },
  {
    version: 1,
    category: 'information_exposure',
    toolId: 'check_exposure',
    references: ['WSTG-INFO-05', 'v5.0.0-V3.4.4', 'CWE-200'],
    requiredRoles: [],
    requiredResources: ['harmless-marker'],
    requiredEvidence: ['response marker'],
    expectedBehavior: 'The known harmless marker is absent from the public response.',
    approvalRequired: false,
    limits: bounds,
  },
];

const contextSchema = z
  .object({
    /** Whether source evidence contains the relevant test surface. */
    surfacePresent: z.boolean(),
    /** Whether all required owned resources and bindings are available. */
    prerequisitesReady: z.boolean(),
    /** Whether the exact operation fits current authorization. */
    scopeApproved: z.boolean(),
    /** Whether the bounded verification completed with admissible observations. */
    completed: z.boolean(),
    /** Whether all participating identities passed the trusted check. */
    identityValid: z.boolean().default(true),
  })
  .strict();
const responseCode = z.number().int().min(100).max(599);
/** Validated observation contract; bounds and cross-field rules are enforced before use. */
export const observationSchema = z.discriminatedUnion('category', [
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('idor'),
      /** Trusted HTTP status observed for the resource owner. */
      ownerStatus: responseCode,
      /** Trusted HTTP status observed for the alternate identity. */
      alternateStatus: responseCode,
      /** Verified resource-owner identity. */
      ownerIdentity: z.string().min(1),
      /** Verified distinct alternate identity. */
      alternateIdentity: z.string().min(1),
      /** Confirms registration of the project-owned comparison resource. */
      resourceOwned: z.literal(true),
      /** Expected marker observed for the resource owner. */
      ownerMarker: z.string().min(8).max(80),
      /** Owned marker observed for the alternate identity, or null if absent. */
      alternateMarker: z.string().max(80).nullable(),
    })
    .strict()
    .refine(value => value.ownerIdentity !== value.alternateIdentity),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('authentication_bypass'),
      /** Trusted HTTP status for the authenticated request. */
      protectedStatus: responseCode,
      /** Trusted HTTP status for the public request. */
      publicStatus: responseCode,
      /** Trusted HTTP status for the invalid-session comparison. */
      invalidSessionStatus: responseCode,
      /** Owned marker observed with valid authentication. */
      protectedMarker: z.string().min(8).max(80),
      /** Owned marker observed publicly, or null if absent. */
      publicMarker: z.string().max(80).nullable(),
      /** Owned marker observed with an invalid session, or null if absent. */
      invalidSessionMarker: z.string().max(80).nullable(),
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('bfla'),
      /** Trusted HTTP status for the administrator. */
      adminStatus: responseCode,
      /** Trusted HTTP status for the lower-privilege identity. */
      lowStatus: responseCode,
      /** Confirms the compared roles are distinct. */
      rolesDistinct: z.literal(true),
      /** Confirms the comparison does not perform writes. */
      readOnly: z.literal(true),
      /** Owned marker observed for the administrator. */
      adminMarker: z.string().min(8).max(80),
      /** Owned marker observed for the lower-privilege identity, or null if absent. */
      lowMarker: z.string().max(80).nullable(),
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('ssrf'),
      /** Deployment classification; lab alone does not grant private-network access. */
      environment: z.enum(['lab', 'staging', 'production']),
      /** Exact approval identifier authorizing the active probe. */
      approvalId: z.string().uuid().optional(),
      /** Whether the approval matches current revisions and has not expired. */
      approvalCurrent: z.boolean(),
      /** Whether the destination is the approval-specific owned receiver. */
      ownedCallback: z.boolean(),
      /** Whether that owned receiver recorded the exact callback. */
      callbackObserved: z.boolean(),
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('misconfiguration'),
      /** Allowlisted security response header evaluated by the configuration check. */
      headerName: z.string().regex(/^[a-z0-9-]{1,80}$/),
      /** Registered safe value expected by the configuration check. */
      expectedValue: z.string().min(1).max(300),
      /** Sanitized response-header value, or null if absent. */
      observedValue: z.string().max(300).nullable(),
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('cors'),
      /** Confirms the request originated from the owned cross-origin browser fixture. */
      browserCrossOrigin: z.literal(true),
      /** Confirms the registered fixture represents protected data. */
      sensitiveFixture: z.literal(true),
      /** Whether the completed cross-origin response was readable by the browser. */
      responseReadable: z.boolean(),
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('open_redirect'),
      /** Authorized origin of the redirecting endpoint. */
      approvedOrigin: z.url(),
      /** Fixed destination supplied to the redirect parameter. */
      submittedDestination: z.url(),
      /** Observed redirect location, or null if absent; it is never followed. */
      location: z.url().nullable(),
      /** Always false; redirect verification never follows the destination. */
      followed: z.literal(false),
    })
    .strict(),
  z
    .object({
      /** Discriminator selecting the vulnerability category and its typed facts. */
      category: z.literal('information_exposure'),
      /** Registered owned-lab marker used only by deterministic verification. */
      marker: z.string().regex(/^LAB_MARKER_[A-Z0-9]{8,64}$/),
      /** Owned marker observed in the response, or null if absent. */
      observedMarker: z.string().nullable(),
      /** Confirms the response was obtained with the public profile. */
      publicResponse: z.literal(true),
    })
    .strict(),
]);
/** Category-discriminated deterministic facts used to assess one verification. */
export type Observation = z.infer<typeof observationSchema>;

const tools: Record<Category, (observation: Observation) => Outcome> = {
  /** Classify owner/alternate object reads from matching markers and explicit denial statuses. */
  idor: value =>
    value.category === 'idor' && value.ownerStatus === 200
      ? value.alternateStatus === 200 && value.alternateMarker === value.ownerMarker
        ? 'CONFIRMED'
        : [401, 403, 404].includes(value.alternateStatus)
          ? 'NOT_REPRODUCED'
          : 'INCONCLUSIVE'
      : 'INCONCLUSIVE',
  /** Classify public and invalid-session access against the authenticated protected-resource baseline. */
  authentication_bypass: value =>
    value.category === 'authentication_bypass' && value.protectedStatus === 200
      ? (value.publicStatus === 200 && value.publicMarker === value.protectedMarker) ||
        (value.invalidSessionStatus === 200 && value.invalidSessionMarker === value.protectedMarker)
        ? 'CONFIRMED'
        : [401, 403, 404].includes(value.publicStatus) && [401, 403, 404].includes(value.invalidSessionStatus)
          ? 'NOT_REPRODUCED'
          : 'INCONCLUSIVE'
      : 'INCONCLUSIVE',
  /** Classify low-role access against the successful administrator read and matching marker. */
  bfla: value =>
    value.category === 'bfla' && value.adminStatus === 200
      ? value.lowStatus === 200 && value.lowMarker === value.adminMarker
        ? 'CONFIRMED'
        : [401, 403, 404].includes(value.lowStatus)
          ? 'NOT_REPRODUCED'
          : 'INCONCLUSIVE'
      : 'INCONCLUSIVE',
  /** Classify an observed callback only for a current approved active check in the owned lab. */
  ssrf: value =>
    value.category === 'ssrf' &&
    value.environment === 'lab' &&
    value.approvalId &&
    value.approvalCurrent &&
    value.ownedCallback
      ? value.callbackObserved
        ? 'CONFIRMED'
        : 'NOT_REPRODUCED'
      : 'BLOCKED',
  /** Compare the observed configuration value with its expected value for the matching category. */
  misconfiguration: value =>
    value.category === 'misconfiguration'
      ? value.observedValue !== value.expectedValue
        ? 'CONFIRMED'
        : 'NOT_REPRODUCED'
      : 'INCONCLUSIVE',
  /** Classify whether the browser could read the response for the CORS category. */
  cors: value =>
    value.category === 'cors' ? (value.responseReadable ? 'CONFIRMED' : 'NOT_REPRODUCED') : 'INCONCLUSIVE',
  /** Confirm a redirect only when its observed external location equals the submitted destination. */
  open_redirect: value =>
    value.category === 'open_redirect'
      ? value.location &&
        new URL(value.location).origin !== new URL(value.approvedOrigin).origin &&
        value.location === value.submittedDestination
        ? 'CONFIRMED'
        : 'NOT_REPRODUCED'
      : 'INCONCLUSIVE',
  /** Compare the observed information-exposure marker with the expected controlled marker. */
  information_exposure: value =>
    value.category === 'information_exposure'
      ? value.observedMarker === value.marker
        ? 'CONFIRMED'
        : 'NOT_REPRODUCED'
      : 'INCONCLUSIVE',
};

export class PlaybookRegistry {
  private readonly byCategory = new Map<Category, Playbook>();
  constructor(private readonly catalog: ReferenceCatalog) {}
  /** Load the bundled playbook registry and verify its referenced knowledge bindings. */
  async initialize() {
    await this.catalog.verify();
    for (const input of definitions) {
      const playbook = playbookSchema.parse(input);
      if (this.byCategory.has(playbook.category) || !tools[playbook.category])
        throw new ControlPlaneError('PLAYBOOK_REGISTRY_INVALID', 503);
      for (const id of playbook.references) await this.catalog.resolve(id);
      this.byCategory.set(playbook.category, playbook);
    }
    if (this.byCategory.size !== categories.length) throw new ControlPlaneError('PLAYBOOK_REGISTRY_INVALID', 503);
  }
  async list() {
    await this.catalog.verify();
    return [...this.byCategory.values()];
  }
  /** Resolve a playbook's pinned version, source digest and reference bindings. */
  async binding(category: Category): Promise<PlaybookBinding> {
    const playbook = (await this.list()).find(item => item.category === category);
    if (!playbook) throw new ControlPlaneError('PLAYBOOK_NOT_FOUND', 404);
    return {
      catalogDigest: await this.catalog.contentDigest(),
      playbookId: playbook.category,
      playbookVersion: playbook.version,
      playbookDigest: createHash('sha256').update(JSON.stringify(playbook)).digest('hex'),
    };
  }
  /** Classify supported playbook applicability without inventing missing target evidence. */
  async assess(
    category: Category,
    context: unknown,
    evidence: unknown,
  ): Promise<{ category: Category; outcome: Outcome }> {
    await this.catalog.verify();
    if (!this.byCategory.has(category)) throw new ControlPlaneError('PLAYBOOK_NOT_FOUND', 404);
    const scope = parse(contextSchema, context);
    if (!scope.scopeApproved) return { category, outcome: 'OUT_OF_SCOPE' };
    if (!scope.surfacePresent) return { category, outcome: 'NOT_APPLICABLE' };
    if (!scope.prerequisitesReady) return { category, outcome: 'PRECONDITION_MISSING' };
    if (!scope.identityValid) return { category, outcome: 'AUTH_REQUIRED' };
    if (!scope.completed) return { category, outcome: 'INCONCLUSIVE' };
    const observation = parse(observationSchema, evidence);
    if (observation.category !== category) throw new ControlPlaneError('VALIDATION_FAILED', 400);
    return { category, outcome: tools[category](observation) };
  }
}
