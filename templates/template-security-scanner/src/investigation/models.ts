import { z } from 'zod';
import { ControlPlaneError } from '../core/contracts.js';
import type { Agent } from '@mastra/core/agent';
import { toStandardSchema } from '@mastra/core/schema';
import { hypothesisSchema, hypothesisRules, type HypothesisInput, type InvestigationAdmission } from './contracts.js';
import type { Evidence } from '../discovery/contracts.js';
import type { PlanningAdvisory } from '../advisory/store.js';
import type { Category, Observation, Playbook } from '../knowledge/playbooks.js';
import type { VerificationProof } from './verification.js';
import { vulnerabilityAssessmentContract } from './semantics.js';

/** Validated vote contract; bounds and cross-field rules are enforced before use. */
export const voteSchema = z
  .object({
    /** Independent agreement, disagreement, or uncertainty about the fixed vulnerability claim. */
    vote: z.enum(['agree', 'disagree', 'uncertain']),
    /** Finite sanitized diagnostic code rather than model prose. */
    reasonCode: z.string().regex(/^[A-Z_]{3,60}$/),
  })
  .strict();
/** Validated interpretation contract; bounds and cross-field rules are enforced before use. */
export const interpretationSchema = z
  .object({
    /** Discriminator selecting the vulnerability category and its typed facts. */
    category: z.string(),
    /** Deterministic verification outcome after applicable evidence review. */
    outcome: z.enum([
      'CONFIRMED',
      'NOT_REPRODUCED',
      'INCONCLUSIVE',
      'NOT_APPLICABLE',
      'PRECONDITION_MISSING',
      'AUTH_REQUIRED',
      'BLOCKED',
      'OUT_OF_SCOPE',
      'EXECUTION_ERROR',
    ]),
  })
  .strict();
/** Validated model result plus optional provider usage metadata. */
export type ModelCall<T> = {
  /** Structured model result validated before it reaches domain logic. */
  value: T;
  /** Model identifier returned by this completed model call. */
  modelId: string;
  /** Provider-reported usage, or null when unavailable. */
  usageTokens: number | null;
};
/** Trusted atomic reservation boundary invoked before model dispatch. */
export type ModelBudget = {
  /** Atomically reserve conservative input/output capacity before each model call. */
  reserve(role: 'nemo' | 'sherlock' | 'dupin' | 'watson', inputBytes: number, outputTokens: number): Promise<void>;
};
/** Operator-selected planning envelope; it does not reserve remaining capacity. */
export type PlanningLimits = Pick<InvestigationAdmission, 'maxRequests' | 'maxDurationSeconds' | 'maxTokens'>;
/** Minimized revision-bound resource context for the exact supplied evidence slice. */
export type PlanningResources = {
  /** Exact target revision authorized for this operation. */
  targetRevision: number;
  /** Exact policy revision authorized for this operation. */
  policyRevision: number;
  /** Declares that resource context covers only the first 32 supplied evidence rows. */
  coverage: 'SUPPLIED_FIRST_32_EVIDENCE';
  /** Whether this bounded context covers all available source evidence. */
  complete: boolean;
  /** Revision-bound available resources; context does not authorize execution. */
  bindings: {
    /** Discriminator selecting the vulnerability category and its typed facts. */
    category: Category;
    /** Zero-based indexes into the exact supplied sanitized evidence slice. */
    evidenceIndexes: number[];
    /** Persisted lifecycle state; read the reason and result before interpreting it. */
    state: 'CURRENT' | 'STALE';
    /** Capability-role to supplied evidence-role mapping; null means the role was withheld. */
    roles: Record<string, string | null>;
  }[];
};
/** Typed model boundary; models cannot authorize or dispatch capabilities. */
export interface InvestigationModels {
  /** Plan grounded hypotheses from bounded evidence without authorizing network actions. */
  propose(
    scanId: string,
    evidence: Evidence[],
    playbooks: Playbook[],
    advisories: PlanningAdvisory[],
    planningLimits: PlanningLimits,
    limit: number,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
    availableResources?: PlanningResources,
  ): Promise<ModelCall<HypothesisInput[]>>;
  /** Interpret one deterministic proof without choosing or executing a capability. */
  interpret(
    proof: VerificationProof,
    playbook: Playbook,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
  ): Promise<ModelCall<z.infer<typeof interpretationSchema>>>;
  /** Independently review the fixed claim using only the supplied proof. */
  review(
    proof: VerificationProof,
    playbook: Playbook,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
  ): Promise<ModelCall<z.infer<typeof voteSchema>>>;
}

type AgentSet = { nemo: Agent; sherlock: Agent; dupin: Agent; watson: Agent };

/** Build the trusted playbook catalogue and immutable planning limits sent to the models. */
function planningContract(playbooks: Playbook[], authorized: PlanningLimits, limit: number) {
  const catalog = playbooks.map(item => ({
    category: item.category,
    toolId: item.toolId,
    references: item.references,
    requiredRoles: item.requiredRoles,
    requiredEvidence: item.requiredEvidence,
    limits: {
      maxAttempts: item.limits.maxAttempts,
      maxRequests: Math.min(
        hypothesisSchema.shape.maxRequests.maxValue!,
        item.limits.maxRequests,
        authorized.maxRequests,
      ),
      maxDurationSeconds: Math.min(
        hypothesisSchema.shape.maxDurationSeconds.maxValue!,
        item.limits.maxDurationSeconds,
        authorized.maxDurationSeconds,
      ),
      maxTokens: Math.min(hypothesisSchema.shape.maxTokens.maxValue!, authorized.maxTokens),
    },
  }));
  // Categories with identical effective limits share one schema branch to keep model input bounded.
  const groups = new Map<string, { categories: Category[]; limits: PlanningLimits }>();
  for (const item of catalog) {
    const { maxRequests, maxDurationSeconds, maxTokens } = item.limits;
    const limits = { maxRequests, maxDurationSeconds, maxTokens };
    const key = JSON.stringify(limits);
    const group = groups.get(key) ?? { categories: [], limits };
    group.categories.push(item.category);
    groups.set(key, group);
  }
  const maximum = {
    maxAttempts: Math.max(0, ...catalog.map(item => item.limits.maxAttempts)),
    maxRequests: Math.max(0, ...catalog.map(item => item.limits.maxRequests)),
    maxDurationSeconds: Math.max(0, ...catalog.map(item => item.limits.maxDurationSeconds)),
    maxTokens: Math.max(0, ...catalog.map(item => item.limits.maxTokens)),
  };
  const shared = hypothesisSchema.safeExtend({
    category: z.enum(catalog.map(item => item.category)),
    maxRequests: hypothesisSchema.shape.maxRequests.max(maximum.maxRequests),
    maxDurationSeconds: hypothesisSchema.shape.maxDurationSeconds.max(maximum.maxDurationSeconds),
    maxTokens: hypothesisSchema.shape.maxTokens.max(maximum.maxTokens),
  });
  const variants = [...groups.values()].map(group =>
    z.looseObject({
      category: z.enum(group.categories),
      ...Object.fromEntries(
        (['maxRequests', 'maxDurationSeconds', 'maxTokens'] as const)
          .filter(field => group.limits[field] < maximum[field])
          .map(field => [field, hypothesisSchema.shape[field].max(group.limits[field])]),
      ),
    }),
  );
  const proposal = variants.length <= 1 ? shared : z.intersection(shared, z.union(variants));
  const container = (item: z.ZodType<HypothesisInput>) => z.object({ hypotheses: z.array(item).max(limit) }).strict();
  // Zod expands intersections into repeated complete objects. The equivalent wire schema
  // shares the strict object and intersects it with only the category-specific constraints.
  // Morph rejects uniqueItems; hypothesisSchema still enforces evidence ID uniqueness locally.
  const wireSchema = z.toJSONSchema(container(shared), {
    target: 'draft-7',
    /** Add category-specific JSON Schema limits when planning variants share a common schema. */
    override: context => {
      if (context.zodSchema === shared && variants.length > 1)
        context.jsonSchema.anyOf = [...groups.values()].map(group => ({
          properties: {
            category: { enum: group.categories },
            ...Object.fromEntries(
              (['maxRequests', 'maxDurationSeconds', 'maxTokens'] as const)
                .filter(field => group.limits[field] < maximum[field])
                .map(field => [field, { maximum: group.limits[field] }]),
            ),
          },
        }));
    },
  });
  const schema = container(proposal);
  const standard = toStandardSchema(schema);
  return {
    catalog: catalog.map(item => ({
      ...item,
      limits: Object.fromEntries(
        (['maxAttempts', 'maxRequests', 'maxDurationSeconds', 'maxTokens'] as const)
          .filter(field => item.limits[field] !== maximum[field])
          .map(field => [field, item.limits[field]]),
      ),
    })),
    effectiveLimitDefaults: maximum,
    schema,
    wireSchema,
    structuredSchema: {
      '~standard': {
        ...standard['~standard'],
        jsonSchema: { input: () => wireSchema, output: () => wireSchema },
      },
    },
  };
}
/** Accept finite numeric model usage and preserve null for unavailable or invalid measurements. */
const usage = (response: { usage?: { totalTokens?: number } }) =>
  typeof response.usage?.totalTokens === 'number' && Number.isFinite(response.usage.totalTokens)
    ? response.usage.totalTokens
    : null;

/** Project a typed verification observation into the facts allowed at the model boundary. */
function observationFacts(observation: Observation | undefined) {
  if (!observation) return null;
  switch (observation.category) {
    case 'idor':
      return {
        ownerStatus: observation.ownerStatus,
        alternateStatus: observation.alternateStatus,
        identitiesDistinct: observation.ownerIdentity !== observation.alternateIdentity,
        resourceOwned: observation.resourceOwned,
        alternateMatchesOwnerMarker:
          observation.alternateMarker !== null && observation.alternateMarker === observation.ownerMarker,
      };
    case 'authentication_bypass':
      return {
        protectedStatus: observation.protectedStatus,
        publicStatus: observation.publicStatus,
        invalidSessionStatus: observation.invalidSessionStatus,
        publicMatchesProtectedMarker:
          observation.publicMarker !== null && observation.publicMarker === observation.protectedMarker,
        invalidSessionMatchesProtectedMarker:
          observation.invalidSessionMarker !== null && observation.invalidSessionMarker === observation.protectedMarker,
      };
    case 'bfla':
      return {
        adminStatus: observation.adminStatus,
        lowStatus: observation.lowStatus,
        rolesDistinct: observation.rolesDistinct,
        readOnly: observation.readOnly,
        lowMatchesAdminMarker: observation.lowMarker !== null && observation.lowMarker === observation.adminMarker,
      };
    case 'ssrf':
      return {
        ownedEnvironment: observation.environment === 'lab',
        approvalRecorded: Boolean(observation.approvalId),
        approvalCurrent: observation.approvalCurrent,
        ownedCallback: observation.ownedCallback,
        callbackObserved: observation.callbackObserved,
      };
    case 'misconfiguration':
      return {
        observedHeaderPresent: observation.observedValue !== null,
        observedMatchesExpected: observation.observedValue === observation.expectedValue,
      };
    case 'cors':
      return {
        browserCrossOrigin: observation.browserCrossOrigin,
        sensitiveFixture: observation.sensitiveFixture,
        responseReadable: observation.responseReadable,
      };
    case 'open_redirect':
      return {
        locationPresent: observation.location !== null,
        locationOutsideApprovedOrigin:
          observation.location === null
            ? null
            : new URL(observation.location).origin !== new URL(observation.approvedOrigin).origin,
        destinationOutsideApprovedOrigin:
          new URL(observation.submittedDestination).origin !== new URL(observation.approvedOrigin).origin,
        locationMatchesSubmittedDestination: observation.location === observation.submittedDestination,
        followed: observation.followed,
      };
    case 'information_exposure':
      return {
        publicResponse: observation.publicResponse,
        observedMatchesKnownMarker: observation.observedMarker === observation.marker,
      };
  }
}

/** Export the minimized verification context after filtering credential-sensitive evidence. */
export function sanitizedVerificationInput(proof: VerificationProof, playbook: Playbook) {
  if (
    proof.category !== playbook.category ||
    proof.evidence.some(item => !playbook.requiredEvidence.includes(item.kind))
  )
    throw new Error('MODEL_REVIEW_PROOF_INVALID');
  return JSON.stringify({
    category: proof.category,
    assessment: vulnerabilityAssessmentContract(proof.category),
    expectedCriterion: playbook.expectedBehavior,
    source: proof.source,
    completed: proof.completed,
    withheld: proof.withheld,
    surfacePresent: proof.surfacePresent,
    prerequisitesReady: proof.prerequisitesReady,
    identityValid: proof.identityValid,
    scopeApproved: proof.scopeApproved,
    requestCount: proof.requestCount,
    evidence: proof.evidence.map(item => ({ id: item.id, kind: item.kind })),
    facts: observationFacts(proof.observation),
  });
}

export class MastraInvestigationModels implements InvestigationModels {
  constructor(
    private readonly agents: AgentSet,
    private readonly explorerId: string,
    private readonly judgeId: string,
  ) {}
  /** Send Nemo and Sherlock bounded evidence and the complete trusted catalogue within the shared input allowance. */
  async propose(
    scanId: string,
    evidence: Evidence[],
    playbooks: Playbook[],
    advisories: PlanningAdvisory[],
    planningLimits: PlanningLimits,
    limit: number,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
    availableResources?: PlanningResources,
  ) {
    const minimal = evidence.slice(0, 32).map(item => ({
      id: item.id,
      kind: item.observation.kind,
      role: item.observation.role,
      method: item.observation.method,
      status: item.observation.status ?? null,
      parameterNames: [...item.observation.parameterNames],
    }));
    const {
      catalog,
      effectiveLimitDefaults,
      schema: proposalsSchema,
      wireSchema,
      structuredSchema,
    } = planningContract(playbooks, planningLimits, limit);
    /** Remove the last optional parameter name to reduce serialized planning input size. */
    const trimParameters = () => {
      const item = minimal.findLast(item => item.parameterNames.length > 0);
      if (!item) return false;
      item.parameterNames = [];
      return true;
    };
    let contextTruncated = evidence.length > minimal.length;
    let summaryPrompt = JSON.stringify({ evidence: minimal });
    while (Buffer.byteLength(summaryPrompt) > 8192) {
      if (!trimParameters()) {
        if (minimal.length <= 1) break;
        minimal.pop();
      }
      contextTruncated = true;
      summaryPrompt = JSON.stringify({ evidence: minimal });
    }
    if (Buffer.byteLength(summaryPrompt) > 8192) throw new ControlPlaneError('MODEL_INPUT_BOUND_EXCEEDED', 403);
    await budget.reserve('nemo', Buffer.byteLength(summaryPrompt), 512);
    signal.throwIfAborted();
    const summary = await this.agents.nemo.generate(summaryPrompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      modelSettings: { maxOutputTokens: 512, maxRetries: 0 },
    });
    const visibleRoles = new Set(minimal.map(item => item.role));
    const resourceContext = availableResources
      ? {
          ...availableResources,
          complete: availableResources.complete && minimal.length === Math.min(evidence.length, 32),
          bindings: availableResources.bindings.map(binding => ({
            ...binding,
            evidenceIndexes: binding.evidenceIndexes.filter(index => index < minimal.length),
            roles: Object.fromEntries(
              Object.entries(binding.roles).map(([role, value]) => [
                role,
                value !== null && visibleRoles.has(value) ? value : null,
              ]),
            ),
          })),
        }
      : null;
    const prompt = {
      scanId,
      evidence: minimal,
      playbookFields: ['category', 'toolId', 'references', 'requiredRoles', 'requiredEvidence', 'limits'],
      playbooks: catalog.map(item => [
        item.category,
        item.toolId,
        item.references,
        item.requiredRoles,
        item.requiredEvidence,
        item.limits,
      ]),
      effectiveLimitDefaults,
      advisoryCandidates: [...advisories],
      inventorySummary: summary.text.slice(0, 2048),
      contextTruncated: contextTruncated ? true : (undefined as true | undefined),
      availableResources: resourceContext,
      maximumHypotheses: limit,
      planningLimits,
      hypothesisRules: {
        tool: true,
        active: hypothesisRules.activeRiskIffCategory,
        paired: true,
        advisory: hypothesisRules.advisoryPresentIffOrigin,
        unique: true,
      },
    };
    const schemaBytes = Buffer.byteLength(JSON.stringify(wireSchema));
    const schemaOverhead = Math.max(0, schemaBytes - 2048);
    let hypothesisPrompt = JSON.stringify(prompt);
    // Keep the complete trusted catalog, semantic rules, limits, and schema.
    // Remove only optional context, then a suffix of evidence if necessary.
    while (Buffer.byteLength(hypothesisPrompt) + schemaOverhead > 8192) {
      prompt.contextTruncated = true;
      if (prompt.inventorySummary.length)
        prompt.inventorySummary = prompt.inventorySummary.slice(0, Math.floor(prompt.inventorySummary.length / 2));
      else if (prompt.advisoryCandidates.length > 1) prompt.advisoryCandidates.pop();
      else if (resourceContext?.bindings.length) {
        resourceContext.bindings.pop();
        resourceContext.complete = false;
      } else if (minimal.some(item => item.parameterNames.length > 0)) trimParameters();
      else if (minimal.length > 1) {
        minimal.pop();
        if (resourceContext) resourceContext.complete = false;
      } else if (prompt.advisoryCandidates.length) prompt.advisoryCandidates.pop();
      else throw new ControlPlaneError('MODEL_INPUT_BOUND_EXCEEDED', 403);
      hypothesisPrompt = JSON.stringify(prompt);
    }
    // The shared model budget already reserves a 2048-byte schema/framing margin.
    await budget.reserve('sherlock', Buffer.byteLength(hypothesisPrompt) + schemaOverhead, 2048);
    signal.throwIfAborted();
    const response = await this.agents.sherlock.generate(hypothesisPrompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      modelSettings: { maxOutputTokens: 2048, maxRetries: 0 },
      structuredOutput: { schema: structuredSchema, errorStrategy: 'strict' },
    });
    const primaryUsage = usage(response),
      summaryUsage = usage(summary);
    return {
      value: proposalsSchema.parse(response.object).hypotheses,
      modelId: this.explorerId,
      usageTokens: primaryUsage === null && summaryUsage === null ? null : (primaryUsage ?? 0) + (summaryUsage ?? 0),
    };
  }
  async interpret(
    proof: VerificationProof,
    playbook: Playbook,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
  ) {
    const prompt = sanitizedVerificationInput(proof, playbook);
    await budget.reserve('dupin', Buffer.byteLength(prompt), 512);
    signal.throwIfAborted();
    const response = await this.agents.dupin.generate(prompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      modelSettings: { maxOutputTokens: 512, maxRetries: 0 },
      structuredOutput: { schema: interpretationSchema, errorStrategy: 'strict' },
    });
    return {
      value: interpretationSchema.parse(response.object),
      modelId: this.explorerId,
      usageTokens: usage(response),
    };
  }
  async review(
    proof: VerificationProof,
    playbook: Playbook,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
  ) {
    const prompt = sanitizedVerificationInput(proof, playbook);
    await budget.reserve('watson', Buffer.byteLength(prompt), 512);
    signal.throwIfAborted();
    const response = await this.agents.watson.generate(prompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      modelSettings: { maxOutputTokens: 512, maxRetries: 0 },
      structuredOutput: { schema: voteSchema, errorStrategy: 'strict' },
    });
    return { value: voteSchema.parse(response.object), modelId: this.judgeId, usageTokens: usage(response) };
  }
}
