import type { Classifier } from '@mastra/core/classifier';

import { TIMING } from '../config';
import {
  COMPETITOR_CHANGE_QUESTIONS,
  QUESTION_SET_VERSION,
  classificationAbortSignal,
  classificationState,
  routeClassification,
} from '../lib/classification';
import type { PendingCandidate } from '../lib/store';
import type { MonitorInput, MonitorSource } from '../schemas';
import type { Dependencies } from './competitor-monitor-steps/workflow-context';

function boundedConfidence(value: unknown, question: string) {
  const confidence = value && typeof value === 'object' ? (value as Record<string, unknown>)[question] : undefined;
  return typeof confidence === 'number' && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
    ? confidence
    : undefined;
}

export async function classifyCandidate({
  candidate,
  source,
  input,
  dependencies,
  getClassifier,
  abortSignal,
  runId,
}: {
  candidate: PendingCandidate;
  source: MonitorSource;
  input: MonitorInput;
  dependencies: Dependencies;
  getClassifier: () => Classifier<typeof COMPETITOR_CHANGE_QUESTIONS> | undefined;
  abortSignal: AbortSignal;
  runId: string;
}) {
  const state = classificationState({
    evidence: candidate,
    source,
    interests: input.profile.interests,
    prioritySignals: input.profile.prioritySignals,
    ignoredSignals: input.profile.ignoredSignals,
    organizationContext: input.profile.organizationContext,
  });
  if (!dependencies.config.credentials.jevApiKey) {
    return {
      id: candidate.candidateId,
      sourceId: source.id,
      status: 'deferred' as const,
      reason: 'JEV_NOT_CONFIGURED',
    };
  }
  const classifier = getClassifier();
  if (!classifier) throw new Error('CLASSIFIER_NOT_REGISTERED');
  if (abortSignal.aborted) return undefined;
  const result = await classifier.evaluate({
    state,
    abortSignal: classificationAbortSignal(abortSignal),
    maxRetries: TIMING.maxRetries,
  });
  const decision = routeClassification(candidate, result.answers, result.providerMetadata, input.policy);
  const typesafe =
    result.providerMetadata && typeof result.providerMetadata.typesafe === 'object'
      ? (result.providerMetadata.typesafe as Record<string, unknown>)
      : undefined;
  await dependencies.store.commitClassification({
    candidateId: candidate.candidateId,
    questionSetVersion: QUESTION_SET_VERSION,
    decision,
    audit: {
      answers: result.answers,
      usage: {
        ...(result.usage.inputTokens === undefined ? {} : { inputTokens: result.usage.inputTokens }),
        ...(result.usage.outputTokens === undefined ? {} : { outputTokens: result.usage.outputTokens }),
      },
      rounding: result.rounding,
      warnings: result.warnings.map(warning => ({
        type: warning.type,
        ...(warning.type === 'unsupported' ? { feature: warning.feature } : {}),
      })),
      confidence: {
        changeType: boundedConfidence(typesafe?.confidence, 'change_type'),
        relevance: boundedConfidence(typesafe?.confidence, 'relevance'),
        businessImpact: boundedConfidence(typesafe?.confidence, 'business_impact'),
      },
      requestedModel: dependencies.config.models.jev,
      reportedModel: result.response.modelId,
      verifiedModel: undefined,
    },
    ...(input.runMode === 'scheduled'
      ? {
          notification: {
            runId,
            monitorId: input.monitorId,
            monitorName: input.profile.name,
            sourceId: source.id,
            providerIds: (dependencies.notificationProviders ?? []).map(provider => provider.id),
          },
        }
      : {}),
  });
  return {
    id: candidate.candidateId,
    sourceId: source.id,
    status: 'classified' as const,
    route: decision.route,
  };
}
