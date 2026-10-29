import { z } from 'zod';
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
    maxAttempts: z.number().int().min(1).max(4),
    maxRequests: z.number().int().min(1).max(12),
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
    version: z.literal(1),
    category: z.enum(categories),
    toolId: z.enum(Object.keys(registeredTools) as [keyof typeof registeredTools, ...(keyof typeof registeredTools)[]]),
    references: z.array(z.string().min(3)).min(2).max(8),
    requiredRoles: z.array(z.string()).max(2),
    requiredResources: z.array(z.string()).max(3),
    requiredEvidence: z.array(z.string()).min(1).max(6),
    expectedBehavior: z.string().min(10).max(400),
    approvalRequired: z.boolean(),
    limits,
  })
  .strict()
  .refine(value => registeredTools[value.toolId] === value.category);
export type Playbook = z.infer<typeof playbookSchema>;

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
    surfacePresent: z.boolean(),
    prerequisitesReady: z.boolean(),
    scopeApproved: z.boolean(),
    completed: z.boolean(),
    identityValid: z.boolean().default(true),
  })
  .strict();
const responseCode = z.number().int().min(100).max(599);
const observationSchema = z.discriminatedUnion('category', [
  z
    .object({
      category: z.literal('idor'),
      ownerStatus: responseCode,
      alternateStatus: responseCode,
      ownerIdentity: z.string().min(1),
      alternateIdentity: z.string().min(1),
      resourceOwned: z.literal(true),
      ownerMarker: z.string().min(8).max(80),
      alternateMarker: z.string().max(80).nullable(),
    })
    .strict()
    .refine(value => value.ownerIdentity !== value.alternateIdentity),
  z
    .object({
      category: z.literal('authentication_bypass'),
      protectedStatus: responseCode,
      publicStatus: responseCode,
      invalidSessionStatus: responseCode,
      protectedMarker: z.string().min(8).max(80),
      publicMarker: z.string().max(80).nullable(),
      invalidSessionMarker: z.string().max(80).nullable(),
    })
    .strict(),
  z
    .object({
      category: z.literal('bfla'),
      adminStatus: responseCode,
      lowStatus: responseCode,
      rolesDistinct: z.literal(true),
      readOnly: z.literal(true),
      adminMarker: z.string().min(8).max(80),
      lowMarker: z.string().max(80).nullable(),
    })
    .strict(),
  z
    .object({
      category: z.literal('ssrf'),
      environment: z.enum(['lab', 'staging', 'production']),
      approvalId: z.string().uuid().optional(),
      approvalCurrent: z.boolean(),
      ownedCallback: z.boolean(),
      callbackObserved: z.boolean(),
    })
    .strict(),
  z
    .object({
      category: z.literal('misconfiguration'),
      headerName: z.string().regex(/^[a-z0-9-]{1,80}$/),
      expectedValue: z.string().min(1).max(300),
      observedValue: z.string().max(300).nullable(),
    })
    .strict(),
  z
    .object({
      category: z.literal('cors'),
      browserCrossOrigin: z.literal(true),
      sensitiveFixture: z.literal(true),
      responseReadable: z.boolean(),
    })
    .strict(),
  z
    .object({
      category: z.literal('open_redirect'),
      approvedOrigin: z.url(),
      submittedDestination: z.url(),
      location: z.url().nullable(),
      followed: z.literal(false),
    })
    .strict(),
  z
    .object({
      category: z.literal('information_exposure'),
      marker: z.string().regex(/^LAB_MARKER_[A-Z0-9]{8,64}$/),
      observedMarker: z.string().nullable(),
      publicResponse: z.literal(true),
    })
    .strict(),
]);
export type Observation = z.infer<typeof observationSchema>;

const tools: Record<Category, (observation: Observation) => Outcome> = {
  idor: value =>
    value.category === 'idor' && value.ownerStatus === 200
      ? value.alternateStatus === 200 && value.alternateMarker === value.ownerMarker
        ? 'CONFIRMED'
        : [401, 403, 404].includes(value.alternateStatus)
          ? 'NOT_REPRODUCED'
          : 'INCONCLUSIVE'
      : 'INCONCLUSIVE',
  authentication_bypass: value =>
    value.category === 'authentication_bypass' && value.protectedStatus === 200
      ? (value.publicStatus === 200 && value.publicMarker === value.protectedMarker) ||
        (value.invalidSessionStatus === 200 && value.invalidSessionMarker === value.protectedMarker)
        ? 'CONFIRMED'
        : [401, 403, 404].includes(value.publicStatus) && [401, 403, 404].includes(value.invalidSessionStatus)
          ? 'NOT_REPRODUCED'
          : 'INCONCLUSIVE'
      : 'INCONCLUSIVE',
  bfla: value =>
    value.category === 'bfla' && value.adminStatus === 200
      ? value.lowStatus === 200 && value.lowMarker === value.adminMarker
        ? 'CONFIRMED'
        : [401, 403, 404].includes(value.lowStatus)
          ? 'NOT_REPRODUCED'
          : 'INCONCLUSIVE'
      : 'INCONCLUSIVE',
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
  misconfiguration: value =>
    value.category === 'misconfiguration'
      ? value.observedValue !== value.expectedValue
        ? 'CONFIRMED'
        : 'NOT_REPRODUCED'
      : 'INCONCLUSIVE',
  cors: value =>
    value.category === 'cors' ? (value.responseReadable ? 'CONFIRMED' : 'NOT_REPRODUCED') : 'INCONCLUSIVE',
  open_redirect: value =>
    value.category === 'open_redirect'
      ? value.location &&
        new URL(value.location).origin !== new URL(value.approvedOrigin).origin &&
        value.location === value.submittedDestination
        ? 'CONFIRMED'
        : 'NOT_REPRODUCED'
      : 'INCONCLUSIVE',
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
