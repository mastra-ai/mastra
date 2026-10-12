import { describe, it, expect } from 'vitest';
import { defaultExecutionPolicy, executionPolicySchema } from '../../src/mastra/contracts/execution-policy.ts';
import { draftSchema, questionResultSchema, verificationSchema } from '../../src/mastra/contracts/answer.ts';
import { securityOutcomeSchema, usageRecordSchema } from '../../src/mastra/contracts/processing.ts';

describe('processing policy and deterministic result contracts', () => {
  it('requires_finite_execution_and_preserves_explicit_provider_configuration', () => {
    expect(defaultExecutionPolicy).toMatchObject({
      model: 'openai/gpt-6.1-sol',
      api: 'responses',
      reasoningEffort: 'medium',
      serviceTier: 'default',
      concurrency: 4,
      transientRetries: 2,
    });
    for (const key of [
      'concurrency',
      'maxRunElapsedMs',
      'callTimeoutMs',
      'maxInputTokens',
      'maxOutputTokens',
      'maxDetectorAttemptsPerPayload',
    ])
      expect(executionPolicySchema.safeParse({ ...defaultExecutionPolicy, [key]: 0 }).success).toBe(false);
    expect(executionPolicySchema.safeParse({ ...defaultExecutionPolicy, maxOutputTokens: 4001 }).success).toBe(false);
    expect(executionPolicySchema.safeParse({ ...defaultExecutionPolicy, api: 'chat' }).success).toBe(false);
  });
  it('requires_reasoned_unknown_and_linked_security_routing', () => {
    const draft = {
      questionId: 'q',
      domain: 'access',
      value: 'unknown',
      text: '',
      responseOption: null,
      claims: [],
      citations: [],
      coveredSubparts: [],
      confidence: 0,
      limitations: [],
    };
    const result = {
      questionId: 'q',
      order: 0,
      draft,
      interpretation: null,
      status: 'review_required',
      reasons: ['MISSING_EVIDENCE'],
      attempts: 0,
    };
    expect(questionResultSchema.safeParse(result).success).toBe(true);
    expect(questionResultSchema.safeParse({ ...result, reasons: [] }).success).toBe(false);
    expect(questionResultSchema.safeParse({ ...result, status: 'draft_eligible', reasons: [] }).success).toBe(false);
    expect(questionResultSchema.safeParse({ ...result, status: 'security_review_required' }).success).toBe(false);
    expect(
      questionResultSchema.safeParse({ ...result, status: 'security_review_required', reasons: ['SECURITY_BLOCKED'] })
        .success,
    ).toBe(false);
    expect(draftSchema.safeParse({ ...draft, text: 'Unsupported factual answer' }).success).toBe(false);
    expect(draftSchema.safeParse({ ...draft, value: 'yes', text: 'Yes' }).success).toBe(false);
    expect(
      verificationSchema.safeParse({
        supportedClaimIds: ['c'],
        conflictedClaimIds: ['c'],
        unsupportedCommitment: false,
        applicable: true,
        complete: true,
        sensitive: false,
      }).success,
    ).toBe(false);
  });
  it('binds_security_and_usage_status_to_safe_typed_outcomes', () => {
    const security = {
      runId: 'run',
      questionId: 'q',
      policyVersion: 1,
      boundary: 'question',
      gate: 'SEC-001',
      status: 'passed',
      reason: 'PASSED',
      retryEligible: false,
    };
    expect(securityOutcomeSchema.safeParse(security).success).toBe(true);
    expect(securityOutcomeSchema.safeParse({ ...security, status: 'failed' }).success).toBe(false);
    expect(securityOutcomeSchema.safeParse({ ...security, reason: 'payload' }).success).toBe(false);
    const usage = {
      id: 'call',
      runId: 'run',
      questionId: 'q',
      phase: 'injection',
      attempt: 1,
      inputReserved: 8000,
      outputReserved: 4000,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      estimatedUsd: 0.056,
      status: 'uncertain',
      reason: null,
      createdAt: '2026-10-11T00:00:00.000Z',
    };
    expect(usageRecordSchema.safeParse(usage).success).toBe(true);
    expect(usageRecordSchema.safeParse({ ...usage, status: 'observed' }).success).toBe(false);
    expect(usageRecordSchema.safeParse({ ...usage, inputTokens: 100 }).success).toBe(false);
    expect(
      usageRecordSchema.safeParse({
        ...usage,
        status: 'observed',
        inputTokens: 100,
        outputTokens: 100,
        reasoningTokens: 101,
      }).success,
    ).toBe(false);
  });
});
