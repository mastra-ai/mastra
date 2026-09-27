import type { Mastra } from '@mastra/core/mastra';
import type { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';

import type { GroundedAnswerObservation, OrganizationAnswer } from '../answers/schema.js';
import { organizationAnswerSchema } from '../answers/schema.js';
import type { SourceIndex } from '../workspaces/source-index.js';
import type { EvaluationCase, EvaluationEvidence, JudgeResult } from './evaluation.js';
import { validateJudgeResult } from './evaluation.js';

export type ExperimentFamily = 'agent' | 'retrieval' | 'calibration';
export type EvaluationJudge = (input: {
  evaluationCase: EvaluationCase;
  answer: OrganizationAnswer;
  evidence: EvaluationEvidence[];
}) => Promise<JudgeResult>;

export type EvaluationUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

export const groundTruthSchema = z.object({
  id: z.string(),
  kind: z.enum(['answerable', 'paraphrase', 'unknown', 'conflict', 'malicious']),
  question: z.string(),
  requiredRecordIds: z.array(z.string()),
  requiredFacts: z.array(z.string()),
  pairId: z.string().optional(),
});

export const candidateSchema = z.object({
  evaluationCase: groundTruthSchema,
  answer: organizationAnswerSchema,
  evidence: z.array(z.object({ recordId: z.string(), locator: z.string(), sourceId: z.string(), content: z.string() })),
  expectedSupported: z.boolean(),
});

export type NativeDataset = Awaited<ReturnType<Mastra['datasets']['create']>>;
export type NativeExperimentResult = Awaited<ReturnType<NativeDataset['runExperimentItem']>>;
export type NativeExperiment = Awaited<ReturnType<NativeDataset['finalizeExperiment']>>;

export type EvaluationExperimentRuntime = {
  stateDirectory: string;
  fixtureVersion: string;
  provenance: { indexSnapshotVersion: string; answerModel: string; judgeModel: string; rubricVersion: string };
  mastra: Mastra;
  storage: LibSQLStore;
  index: SourceIndex;
  agentDataset: NativeDataset;
  retrievalDataset: NativeDataset;
  calibrationDataset: NativeDataset;
  observations: Map<string, GroundedAnswerObservation>;
  judgments: Map<string, JudgeResult>;
  dispatch: { activeItem?: { experimentId: string; itemId: string; evaluationCaseId: string } };
  close: () => Promise<void>;
};

export type SeededExperimentDatasets = {
  corpusVersion: string;
  fixtureVersion: string;
  agentVersion: number;
  retrievalVersion: number;
  calibrationVersion: number;
};

export type NativeExperimentRun = {
  experimentId: string;
  status: NativeExperiment['status'];
  datasetVersion: number;
  family: ExperimentFamily;
  completedItemIds: string[];
  qualityComplete: boolean;
  storageComplete: boolean;
};

export type NativeRetrievalSummary = {
  experimentId: string;
  meanRequiredRecordRecallAt6: number;
  cases: Array<{
    id: string;
    requiredRecordRecallAt6: number | null;
    outcome: 'retrieved' | 'empty' | 'failed';
  }>;
};

export function asEvaluationCase(value: unknown): EvaluationCase {
  return groundTruthSchema.parse(value);
}

export function normalizeAgentOutput(output: unknown): OrganizationAnswer {
  const candidates: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === 'string') {
      candidates.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    if (typeof value === 'object' && value) Object.values(value).forEach(collect);
  };
  collect(output);
  for (const candidate of candidates) {
    try {
      const parsed = organizationAnswerSchema.safeParse(JSON.parse(candidate));
      if (parsed.success) return parsed.data;
    } catch {
      // Native agent scorer data retains framework messages alongside the JSON answer.
    }
  }
  throw new Error('Native agent output did not contain an OrganizationAnswer.');
}

/** Evaluation-only adapter: keep native agent dispatch while exposing its validated message as the public result. */
export function requireJudgeResult(evaluationCase: EvaluationCase, judge: JudgeResult): JudgeResult {
  validateJudgeResult(evaluationCase, judge);
  return judge;
}

export function score(judge: JudgeResult): number {
  return judge.totalClaims === 0 ? 1 : judge.supportedClaims / judge.totalClaims;
}

export const retrievalOutputSchema = z.object({
  hits: z.array(z.object({ metadata: z.record(z.string(), z.unknown()).optional() })),
});

export function requiredRecordRecall(evaluationCase: EvaluationCase, output: unknown): number {
  const hits = retrievalOutputSchema.parse(output).hits.slice(0, 6);
  if (!evaluationCase.requiredRecordIds.length) return 1;
  const records = new Set(hits.map(hit => String(hit.metadata?.recordId ?? '')));
  return (
    evaluationCase.requiredRecordIds.filter(recordId => records.has(recordId)).length /
    evaluationCase.requiredRecordIds.length
  );
}
