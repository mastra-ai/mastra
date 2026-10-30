import { z } from 'zod';
import type { Agent } from '@mastra/core/agent';
import { hypothesisSchema, type HypothesisInput } from './contracts.js';
import type { Evidence } from '../discovery/contracts.js';
import type { PlanningAdvisory } from '../advisory/store.js';
import type { Observation, Playbook } from '../knowledge/playbooks.js';
import type { VerificationProof } from './verification.js';

const voteSchema = z
  .object({ vote: z.enum(['agree', 'disagree', 'uncertain']), reasonCode: z.string().regex(/^[A-Z_]{3,60}$/) })
  .strict();
const interpretationSchema = z
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
export interface InvestigationModels {
  propose(
    scanId: string,
    evidence: Evidence[],
    playbooks: Playbook[],
    advisories: PlanningAdvisory[],
    limit: number,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
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

function reviewPrompt(proof: VerificationProof, playbook: Playbook) {
  if (
    proof.category !== playbook.category ||
    proof.evidence.some(item => !playbook.requiredEvidence.includes(item.kind))
  )
    throw new Error('MODEL_REVIEW_PROOF_INVALID');
  return JSON.stringify({
    category: proof.category,
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
    limit: number,
    timeoutMs: number,
    budget: ModelBudget,
    signal: AbortSignal,
  ) {
    const minimal = evidence.slice(0, 32).map(item => ({
      id: item.id,
      kind: item.observation.kind,
      role: item.observation.role,
      method: item.observation.method,
      status: item.observation.status ?? null,
      parameterNames: item.observation.parameterNames,
    }));
    const catalog = playbooks.map(item => ({
      category: item.category,
      toolId: item.toolId,
      references: item.references,
      requiredRoles: item.requiredRoles,
      requiredEvidence: item.requiredEvidence,
      limits: item.limits,
    }));
    const summaryPrompt = JSON.stringify({ scanId, evidence: minimal });
    await budget.reserve('nemo', Buffer.byteLength(summaryPrompt), 512);
    signal.throwIfAborted();
    const summary = await this.agents.nemo.generate(summaryPrompt, {
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      modelSettings: { maxOutputTokens: 512, maxRetries: 0 },
    });
    const hypothesisPrompt = JSON.stringify({
      scanId,
      evidence: minimal,
      playbooks: catalog,
      advisoryCandidates: advisories,
      inventorySummary: summary.text.slice(0, 2048),
      maximumHypotheses: limit,
    });
    await budget.reserve('sherlock', Buffer.byteLength(hypothesisPrompt), 2048);
    signal.throwIfAborted();
    const proposalsSchema = z.object({ hypotheses: z.array(hypothesisSchema).max(limit) }).strict();
    const response = await this.agents.sherlock.generate(hypothesisPrompt, {
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      modelSettings: { maxOutputTokens: 2048, maxRetries: 0 },
      structuredOutput: { schema: proposalsSchema, errorStrategy: 'strict' },
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
    const prompt = reviewPrompt(proof, playbook);
    await budget.reserve('dupin', Buffer.byteLength(prompt), 512);
    signal.throwIfAborted();
    const response = await this.agents.dupin.generate(prompt, {
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
    const prompt = reviewPrompt(proof, playbook);
    await budget.reserve('watson', Buffer.byteLength(prompt), 512);
    signal.throwIfAborted();
    const response = await this.agents.watson.generate(prompt, {
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      modelSettings: { maxOutputTokens: 512, maxRetries: 0 },
      structuredOutput: { schema: voteSchema, errorStrategy: 'strict' },
    });
    return { value: voteSchema.parse(response.object), modelId: this.judgeId, usageTokens: usage(response) };
  }
}
