import { z } from 'zod';
import type { Agent } from '@mastra/core/agent';
import { toStandardSchema } from '@mastra/core/schema';
import { hypothesisSchema, hypothesisRules, type HypothesisInput, type InvestigationAdmission } from './contracts.js';
import type { Evidence } from '../discovery/contracts.js';
import type { PlanningAdvisory } from '../advisory/store.js';
import type { Category, Observation, Playbook } from '../knowledge/playbooks.js';
import type { VerificationProof } from './verification.js';
import { vulnerabilityAssessmentContract } from './semantics.js';

export const voteSchema = z
  .object({ vote: z.enum(['agree', 'disagree', 'uncertain']), reasonCode: z.string().regex(/^[A-Z_]{3,60}$/) })
  .strict();
export const interpretationSchema = z
  .object({
    category: z.string(),
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
export type ModelCall<T> = { value: T; modelId: string; usageTokens: number | null };
export type ModelBudget = {
  reserve(role: 'nemo' | 'sherlock' | 'dupin' | 'watson', inputBytes: number, outputTokens: number): Promise<void>;
};
export type PlanningLimits = Pick<InvestigationAdmission, 'maxRequests' | 'maxDurationSeconds' | 'maxTokens'>;
export type PlanningResources = {
  targetRevision: number;
  policyRevision: number;
  coverage: 'SUPPLIED_FIRST_32_EVIDENCE';
  complete: boolean;
  bindings: {
    category: Category;
    evidenceIndexes: number[];
    state: 'CURRENT' | 'STALE';
    roles: Record<string, string | null>;
  }[];
};
export interface InvestigationModels {
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
  interpret(
    proof: VerificationProof,
    playbook: Playbook,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
  ): Promise<ModelCall<z.infer<typeof interpretationSchema>>>;
  review(
    proof: VerificationProof,
    playbook: Playbook,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
  ): Promise<ModelCall<z.infer<typeof voteSchema>>>;
}

type AgentSet = { nemo: Agent; sherlock: Agent; dupin: Agent; watson: Agent };

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
const usage = (response: { usage?: { totalTokens?: number } }) =>
  typeof response.usage?.totalTokens === 'number' && Number.isFinite(response.usage.totalTokens)
    ? response.usage.totalTokens
    : null;

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
      parameterNames: item.observation.parameterNames,
    }));
    const {
      catalog,
      effectiveLimitDefaults,
      schema: proposalsSchema,
      wireSchema,
      structuredSchema,
    } = planningContract(playbooks, planningLimits, limit);
    const summaryPrompt = JSON.stringify({ evidence: minimal });
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
          bindings: availableResources.bindings.map(binding => ({
            ...binding,
            roles: Object.fromEntries(
              Object.entries(binding.roles).map(([role, value]) => [
                role,
                value !== null && visibleRoles.has(value) ? value : null,
              ]),
            ),
          })),
        }
      : null;
    const hypothesisPrompt = JSON.stringify({
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
      advisoryCandidates: advisories,
      inventorySummary: summary.text.slice(0, 2048),
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
    });
    const schemaBytes = Buffer.byteLength(JSON.stringify(wireSchema));
    // The shared model budget already reserves a 2048-byte schema/framing margin.
    await budget.reserve('sherlock', Buffer.byteLength(hypothesisPrompt) + Math.max(0, schemaBytes - 2048), 2048);
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
