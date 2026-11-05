import type { Agent } from '@mastra/core/agent';
import { toStandardSchema } from '@mastra/core/schema';
import { z } from 'zod';
import { bolaSelectionSchema, type BolaCandidate, type BolaSelection } from './bola-contracts.js';

const interpretationSchema = z.object({ outcome: z.enum(['CONFIRMED', 'NOT_REPRODUCED', 'INCONCLUSIVE']) }).strict();
const reviewSchema = z
  .object({ vote: z.enum(['agree', 'disagree', 'uncertain']), reasonCode: z.string().regex(/^[A-Z_]{3,60}$/) })
  .strict();
export type BolaProof = {
  checkerId: 'bola_rest_read';
  principalComparison?: 'SAME' | 'DISTINCT' | 'UNKNOWN';
  candidateId: string;
  ownerStatus: number | null;
  alternateStatus: number | null;
  bodyMatches: boolean | null;
  upstreamObserved: boolean;
  requestCount: number;
  completed: boolean;
  verifierCredentialFree: boolean;
  firewallVerified: boolean;
  directFixtureDenied: boolean | null;
  gatewayCredentialInjections: number;
  verifiedGatewayPeers: number;
};
export type BolaPolicyContext = {
  objectPolicy: 'owner';
  expectedUnauthorizedStatus: readonly number[];
};
export type BolaModelCall<T> = { value: T; modelId: string; usageTokens: number | null };
export type BolaBudget = {
  reserve(role: 'sherlock' | 'dupin' | 'watson', inputBytes: number, outputTokens: number): Promise<void>;
};
export interface BolaModels {
  select(candidates: BolaCandidate[], budget: BolaBudget, signal: AbortSignal): Promise<BolaModelCall<BolaSelection>>;
  interpret(
    proof: BolaProof,
    policy: BolaPolicyContext,
    budget: BolaBudget,
    signal: AbortSignal,
  ): Promise<BolaModelCall<z.infer<typeof interpretationSchema>>>;
  review(
    proof: BolaProof,
    policy: BolaPolicyContext,
    budget: BolaBudget,
    signal: AbortSignal,
  ): Promise<BolaModelCall<z.infer<typeof reviewSchema>>>;
}
/** Read reported BOLA model token usage, preserving null when the provider omits it. */
const usage = (response: { usage?: { totalTokens?: number } }) => response.usage?.totalTokens ?? null;

/** Real Morph-backed agents use the same structured, reserved model boundary as legacy investigations. */
export class MastraBolaModels implements BolaModels {
  constructor(
    private readonly agents: { sherlock: Agent; dupin: Agent; watson: Agent },
    private readonly explorerId: string,
    private readonly judgeId: string,
  ) {}
  async select(candidates: BolaCandidate[], budget: BolaBudget, signal: AbortSignal) {
    const visible = candidates.map(item => ({
      candidateId: item.id,
      routeTemplate: item.routeTemplate,
      prerequisite: item.prerequisite,
      evidenceIds: item.evidenceIds,
      expectedUnauthorizedStatus: item.expectedUnauthorizedStatus,
    }));
    const prompt = JSON.stringify({
      task: 'Select exactly one grounded owner-only REST object-read candidate. State the fixed alternate-account hypothesis, a confidence level, and bounded limitations. Do not invent routes, object IDs, checkers or evidence.',
      checkerId: 'bola_rest_read',
      candidates: visible,
    });
    await budget.reserve('sherlock', Buffer.byteLength(prompt), 512);
    signal.throwIfAborted();
    const response = await this.agents.sherlock.generate(prompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      modelSettings: { maxOutputTokens: 512, maxRetries: 0 },
      structuredOutput: { schema: toStandardSchema(bolaSelectionSchema), errorStrategy: 'strict' },
    });
    return {
      value: bolaSelectionSchema.parse(response.object),
      modelId: this.explorerId,
      usageTokens: usage(response),
    };
  }
  async interpret(proof: BolaProof, policy: BolaPolicyContext, budget: BolaBudget, signal: AbortSignal) {
    const prompt = JSON.stringify({
      task: 'Interpret only the completed BOLA comparison proof; make no new requests. A principalComparison=DISTINCT receipt records different configured account-identifier strings observed in this scan and is required for confirmation. A completed owner HTTP 200 and alternate HTTP 200 with bodyMatches=true supports CONFIRMED when the alternate account was expected to receive an unauthorized status. An observed expected unauthorized alternate status supports NOT_REPRODUCED. An incomplete proof or any other comparison supports INCONCLUSIVE. Do not infer access from route names or model text.',
      proof,
      policy,
    });
    await budget.reserve('dupin', Buffer.byteLength(prompt), 256);
    signal.throwIfAborted();
    const response = await this.agents.dupin.generate(prompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      modelSettings: { maxOutputTokens: 256, maxRetries: 0 },
      structuredOutput: { schema: toStandardSchema(interpretationSchema), errorStrategy: 'strict' },
    });
    return {
      value: interpretationSchema.parse(response.object),
      modelId: this.explorerId,
      usageTokens: usage(response),
    };
  }
  async review(proof: BolaProof, policy: BolaPolicyContext, budget: BolaBudget, signal: AbortSignal) {
    const prompt = JSON.stringify({
      task: 'Independently review only this completed BOLA proof; make no new requests. Agree with CONFIRMED only when the completed proof has principalComparison=DISTINCT, owner HTTP 200, alternate HTTP 200 and bodyMatches=true for the expected unauthorized alternate account. Disagree or mark uncertain when these facts are absent or unreliable. Your vote is a veto, never a substitute for the deterministic proof.',
      proof,
      policy,
    });
    await budget.reserve('watson', Buffer.byteLength(prompt), 256);
    signal.throwIfAborted();
    const response = await this.agents.watson.generate(prompt, {
      maxProcessorRetries: 0,
      toolChoice: 'none',
      maxSteps: 1,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
      modelSettings: { maxOutputTokens: 256, maxRetries: 0 },
      structuredOutput: { schema: toStandardSchema(reviewSchema), errorStrategy: 'strict' },
    });
    return { value: reviewSchema.parse(response.object), modelId: this.judgeId, usageTokens: usage(response) };
  }
}
