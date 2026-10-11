import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { PromptInjectionDetector, PIIDetector } from '@mastra/core/processors';
import { checkLocalContent } from './local-filter.ts';
import type { ExecutionPolicy } from '../contracts/execution-policy.ts';
import type { SecurityOutcome } from '../contracts/processing.ts';
import type { ProcessingStore } from '../persistence/processing.ts';
import { boundedModel, providerOptions } from './model.ts';
import type { ModelFactory } from './model.ts';
import type { RequestContext } from '@mastra/core/request-context';
import { ProcessingFailure } from './failure.ts';

export function createScreening(options: {
  runId: string;
  questionId: string;
  policy: ExecutionPolicy;
  store: ProcessingStore;
  models: ModelFactory;
  requestContext?: RequestContext;
  onAttempt?: () => void;
}) {
  const { runId, questionId, policy, store, models } = options;
  return async (text: string, boundary: SecurityOutcome['boundary']) => {
    const messages: MastraDBMessage[] = [
      { id: questionId, role: 'user', createdAt: new Date(), content: { format: 2, parts: [{ type: 'text', text }] } },
    ];
    const persistOutcome = (
      gate: SecurityOutcome['gate'],
      status: SecurityOutcome['status'],
      reason: SecurityOutcome['reason'],
    ) =>
      store.persistSecurity({
        runId,
        questionId,
        policyVersion: policy.version,
        boundary,
        gate,
        status,
        reason,
        retryEligible: false,
      });
    try {
      await checkLocalContent(text, questionId);
    } catch {
      await persistOutcome('SEC-002', 'blocked', 'REGEX_BLOCKED');
      throw new ProcessingFailure('SECURITY_BLOCKED');
    }

    const detectorAttempts = { count: 0 };
    for (const phase of ['injection', 'pii'] as const) {
      const gate = phase === 'injection' ? 'SEC-001' : 'SEC-002';
      let aborted = false;
      let modelFailed = false;
      try {
        const model = boundedModel({
          ...options,
          phase,
          provider: models(phase, questionId),
          maxTurns: policy.maxDetectorAttemptsPerPayload,
          detectorAttempts,
          onFailure: () => {
            modelFailed = true;
          },
        });
        const processor =
          phase === 'injection'
            ? new PromptInjectionDetector({
                model,
                strategy: 'block',
                errorStrategy: 'strict',
                threshold: policy.injectionThreshold,
                includeScores: false,
                providerOptions,
              })
            : new PIIDetector({
                model,
                strategy: 'block',
                errorStrategy: 'strict',
                threshold: policy.piiThreshold,
                includeDetections: false,
                providerOptions,
              });
        await processor.processInput({
          messages,
          requestContext: options.requestContext,
          abort: () => {
            aborted = true;
            throw new ProcessingFailure('SECURITY_BLOCKED');
          },
        });
        await persistOutcome(gate, 'passed', 'PASSED');
      } catch {
        const state = await store.status(runId);
        const failed = modelFailed || !aborted;
        await persistOutcome(
          gate,
          failed ? 'failed' : 'blocked',
          failed ? 'DETECTOR_FAILED' : phase === 'injection' ? 'INJECTION_BLOCKED' : 'PII_BLOCKED',
        );
        throw new ProcessingFailure(state?.run.stopReason ?? (failed ? 'DETECTOR_FAILED' : 'SECURITY_BLOCKED'));
      }
    }
  };
}
