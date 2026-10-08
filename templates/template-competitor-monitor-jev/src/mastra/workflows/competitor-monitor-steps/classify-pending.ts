import type { Classifier } from '@mastra/core/classifier';
import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { CLASSIFIER_ID, COMPETITOR_CHANGE_QUESTIONS, sanitizedClassificationError } from '../../lib/classification';
import type { MonitorInput } from '../../schemas';
import { classifyCandidate } from '../candidate-classification';
import {
  classifiedSourcesSchema,
  sourceProcessedSchema,
  type MonitorRunResult,
  type StepContext,
} from './workflow-context';

export function createClassifyPendingStep(context: StepContext) {
  const { dependencies, finishCanceledRun } = context;
  return createStep({
    id: 'classify-pending-competitor-changes',
    description:
      'Resumes bounded pending candidates sequentially through the registered native classifier and persists safe decisions.',
    inputSchema: z.array(sourceProcessedSchema),
    outputSchema: classifiedSourcesSchema,
    execute: async ({ inputData, getInitData, mastra, abortSignal }) => {
      const input = getInitData<MonitorInput>();
      const sourceById = new Map(input.sources.map(source => [source.id, source]));
      const changes: MonitorRunResult['changes'] = [];
      const maximum = input.policy.maxCandidatesPerSource ?? dependencies.config.sources.candidatesPerSource;
      let classifier: Classifier<typeof COMPETITOR_CHANGE_QUESTIONS> | undefined;
      const getClassifier = () => {
        classifier ??= mastra.getClassifierById(CLASSIFIER_ID) as
          Classifier<typeof COMPETITOR_CHANGE_QUESTIONS> | undefined;
        return classifier;
      };
      const stopForCancellation = async (processed: (typeof inputData)[number]) => {
        await finishCanceledRun(processed.runId, processed.monitorId);
        return { processed: inputData, changes };
      };

      for (const processed of inputData) {
        if (abortSignal.aborted) return stopForCancellation(processed);
        const source = sourceById.get(processed.sourceId);
        if (!source) continue;
        const candidates = await dependencies.store.pendingCandidatesForSource(input.monitorId, source.id);
        const sourceDeferredReason =
          processed.source.error?.code === 'SOURCE_ID_REBOUND'
            ? 'SOURCE_ID_REBOUND'
            : input.runMode === 'baseline'
              ? 'BASELINE_MODE'
              : undefined;

        for (const [index, candidate] of candidates.entries()) {
          if (abortSignal.aborted) return stopForCancellation(processed);
          const deferredReason = sourceDeferredReason ?? (index >= maximum ? 'CANDIDATE_LIMIT' : undefined);
          if (deferredReason) {
            changes.push({
              id: candidate.candidateId,
              sourceId: source.id,
              status: 'deferred',
              reason: deferredReason,
            });
            continue;
          }
          try {
            const outcome = await classifyCandidate({
              candidate,
              source,
              input,
              dependencies,
              getClassifier,
              abortSignal,
              runId: processed.runId,
            });
            if (!outcome) return stopForCancellation(processed);
            changes.push(outcome);
          } catch (error) {
            if (abortSignal.aborted) return stopForCancellation(processed);
            const reason =
              error instanceof Error && error.message === 'CANDIDATE_STATE_LIMIT'
                ? 'CANDIDATE_STATE_LIMIT'
                : sanitizedClassificationError(error);
            changes.push({
              id: candidate.candidateId,
              sourceId: source.id,
              status: reason === 'CANDIDATE_STATE_LIMIT' ? 'deferred' : 'failed',
              reason,
            });
          }
        }
      }
      return { processed: inputData, changes };
    },
  });
}
