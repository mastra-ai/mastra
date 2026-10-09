import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

import { createOrganizationAgent } from '../agents/organization-agent.js';
import type { GroundedAnswerObservation } from '../answers/schema.js';
import { createSourceSearchWorkflow } from '../workflows/source-search.js';
import type { SourceIndex } from '../workspaces/source-index.js';

import type { EvaluationExperimentRuntime, EvaluationJudge, EvaluationUsage } from './contracts.js';
import {
  asEvaluationCase,
  candidateSchema,
  groundTruthSchema,
  normalizeAgentOutput,
  requireJudgeResult,
  requiredRecordRecall,
  score,
} from './contracts.js';
import { getOrCreateDataset } from './datasets.js';
import type { JudgeResult } from './evaluation.js';
import {
  AGENT_DATASET_ID,
  CALIBRATION_DATASET_ID,
  EVALUATION_PROVIDER_TIMEOUT_MS,
  EVALUATION_STORE_NAME,
  GROUNDEDNESS_SCORER_ID,
  RETRIEVAL_DATASET_ID,
  RETRIEVAL_RECALL_SCORER_ID,
} from './limits.js';
import { assertIsolatedEvaluationState, persistCaseEvidence } from './state.js';

function nativeExperimentAgent(
  index: SourceIndex,
  model: Parameters<typeof createOrganizationAgent>[1],
  onGroundedAnswer: (observation: GroundedAnswerObservation) => void,
  onAnswerDispatch: () => void,
  onAnswerUsage: (usage: EvaluationUsage | undefined) => void,
  providerTimeoutMs: number,
) {
  const agent = createOrganizationAgent(index, model, {
    memory: false,
    maxRetries: 0,
    modelTimeout: { totalMs: providerTimeoutMs, stepMs: providerTimeoutMs, firstChunkMs: providerTimeoutMs },
    onGroundedAnswer,
    onGroundedUsage: onAnswerUsage,
  });
  const generate = agent.generate.bind(agent);
  agent.generate = async (...args: Parameters<typeof generate>) => {
    onAnswerDispatch();
    const result = await generate(...args);
    const answer = normalizeAgentOutput(result.messages);
    return { ...result, text: JSON.stringify(answer) };
  };
  return agent;
}

export async function createEvaluationExperimentRuntime(options: {
  stateDirectory: string;
  index: SourceIndex;
  answerModel: Parameters<typeof createOrganizationAgent>[1];
  judge: EvaluationJudge;
  fixtureVersion: string;
  provenance: { indexSnapshotVersion: string; answerModel: string; judgeModel: string; rubricVersion: string };
  protectedPaths?: string[];
  onAnswerDispatch?: () => void;
  onAnswerUsage?: (usage: EvaluationUsage | undefined) => void;
  providerTimeoutMs?: number;
}): Promise<EvaluationExperimentRuntime> {
  const stateDirectory = await assertIsolatedEvaluationState(options.stateDirectory, options.protectedPaths ?? []);
  await mkdir(stateDirectory, { recursive: true });
  const storage = new LibSQLStore({
    id: EVALUATION_STORE_NAME,
    url: `file:${resolve(stateDirectory, 'experiments.db')}`,
  });
  const observations = new Map<string, GroundedAnswerObservation>();
  const judgments = new Map<string, JudgeResult>();
  const dispatch: EvaluationExperimentRuntime['dispatch'] = {};
  const agent = nativeExperimentAgent(
    options.index,
    options.answerModel,
    observation => observations.set(observation.answer.metadata.correlationId, observation),
    options.onAnswerDispatch ?? (() => undefined),
    options.onAnswerUsage ?? (() => undefined),
    options.providerTimeoutMs ?? EVALUATION_PROVIDER_TIMEOUT_MS,
  );
  const groundednessScorer = createScorer({
    id: GROUNDEDNESS_SCORER_ID,
    name: 'Organization groundedness',
    description: 'Scores the stored normalized Organization Agent answer against its actual retrieved evidence.',
    type: 'agent' as const,
  }).generateScore(async ({ run }) => {
    try {
      const candidate = candidateSchema.safeParse(run);
      if (candidate.success) {
        const judge = requireJudgeResult(
          candidate.data.evaluationCase,
          await options.judge({
            evaluationCase: candidate.data.evaluationCase,
            answer: candidate.data.answer,
            evidence: candidate.data.evidence,
          }),
        );
        return score(judge);
      }
      const answer = normalizeAgentOutput(run.output);
      const observation = observations.get(answer.metadata.correlationId);
      if (!observation) throw new Error('The experiment answer did not retain its grounded retrieval evidence.');
      const evaluationCase = asEvaluationCase(run.groundTruth);
      const binding = dispatch.activeItem;
      if (!binding || binding.evaluationCaseId !== evaluationCase.id)
        throw new Error('Native scorer did not retain an exact experiment item binding.');
      const judge = requireJudgeResult(
        evaluationCase,
        await options.judge({ evaluationCase, answer, evidence: observation.evidence }),
      );
      judgments.set(answer.metadata.correlationId, judge);
      await persistCaseEvidence(stateDirectory, binding, observation, judge);
      return score(judge);
    } catch {
      // Mastra persists scorer errors. Never pass a judge or provider error across this boundary.
      throw new Error('Groundedness scorer failed.');
    }
  });
  const retrievalRecallScorer = createScorer({
    id: RETRIEVAL_RECALL_SCORER_ID,
    name: 'Required-record recall at six',
    description: 'Measures authored required record IDs among the first six persisted retrieval hits.',
    type: 'agent' as const,
  }).generateScore(async ({ run }) => requiredRecordRecall(asEvaluationCase(run.groundTruth), run.output));
  const mastra = new Mastra({
    storage,
    logger: false,
    agents: { organizationAgent: agent },
    workflows: { sourceSearchWorkflow: createSourceSearchWorkflow(options.index) },
    scorers: { groundednessScorer, retrievalRecallScorer },
  });
  const agentDataset = await getOrCreateDataset(mastra, {
    id: AGENT_DATASET_ID,
    name: 'Organization Agent evaluation',
    description: 'Versioned synthetic questions for bounded Organization Agent experiments.',
    inputSchema: z.string().trim().min(1).max(4_000),
    groundTruthSchema,
    targetType: 'agent',
    targetIds: ['organization-agent'],
  });
  const retrievalDataset = await getOrCreateDataset(mastra, {
    id: RETRIEVAL_DATASET_ID,
    name: 'Organization retrieval evaluation',
    description: 'Versioned synthetic questions for retrieval-only experiments.',
    inputSchema: z.object({ question: z.string().trim().min(1).max(4_000) }),
    groundTruthSchema,
    targetType: 'workflow',
    targetIds: ['search-organization-records'],
  });
  const calibrationDataset = await getOrCreateDataset(mastra, {
    id: CALIBRATION_DATASET_ID,
    name: 'Organization judge calibration',
    description: 'Versioned authored stored candidates for groundedness judge calibration.',
    targetType: 'scorer',
    targetIds: [GROUNDEDNESS_SCORER_ID],
  });
  return {
    stateDirectory,
    fixtureVersion: options.fixtureVersion,
    provenance: options.provenance,
    mastra,
    storage,
    index: options.index,
    agentDataset,
    retrievalDataset,
    calibrationDataset,
    observations,
    judgments,
    dispatch,
    close: async () => storage.close(),
  };
}
