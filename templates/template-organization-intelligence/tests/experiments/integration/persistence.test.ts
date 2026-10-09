import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { OrganizationAnswer } from '../../../src/mastra/answers/schema.js';
import { seedExperimentDatasets } from '../../../src/mastra/evaluation/datasets.js';
import type { JudgeResult } from '../../../src/mastra/evaluation/evaluation.js';
import { evaluateInstitutionalKnowledge } from '../../../src/mastra/evaluation/evaluation.js';
import { runNativeExperiment } from '../../../src/mastra/evaluation/experiments.js';
import { EVALUATION_CASES } from '../../../src/mastra/evaluation/fixtures/cases.js';
import {
  inspectNativeExperiments,
  inspectPersistedExperiments,
  nativeAgentEvaluationReport,
  readPersistedNativeAgentEvaluationReport,
} from '../../../src/mastra/evaluation/reports.js';

import { judge, openRuntime } from './helpers/runtime.js';

describe('Native comparable experiments', () => {
  it('experiment reports preserve quality and persist comparisons', async () => {
    const fixture = await openRuntime({
      judge: async input => {
        const result = await judge(input);
        if (input.evaluationCase.id === 'a02-docx-table') return { ...result, supportedClaims: 7, totalClaims: 10 };
        if (input.evaluationCase.id === 'p01-retention-paraphrase') return { ...result, supportedFactIds: [] };
        return result;
      },
    });
    try {
      const seeded = await seedExperimentDatasets(fixture.runtime);
      const agent = await runNativeExperiment(fixture.runtime, { family: 'agent', version: seeded.agentVersion });
      const persistedReport = await readPersistedNativeAgentEvaluationReport(
        fixture.runtime.stateDirectory,
        agent.experimentId,
      );
      expect(persistedReport).toMatchObject({
        caseCount: 30,
        corpusVersion: '2026-09-20.2',
      });
      expect(persistedReport.cases.filter(item => item.failure === 'validation')).toHaveLength(0);
      const evidenceDirectory = join(fixture.runtime.stateDirectory, 'experiment-cases');
      const evidenceFiles = await readdir(evidenceDirectory);
      expect(evidenceFiles).toHaveLength(30);
      const persistedEvidence: Array<{
        experimentId: string;
        itemId: string;
        evaluationCaseId: string;
        correlationId: string;
        observation: {
          answer: OrganizationAnswer;
          evidence: Array<{ recordId: string; locator: string; sourceId: string; content: string }>;
        };
        judge: JudgeResult;
      }> = await Promise.all(
        evidenceFiles.map(async file => JSON.parse(await readFile(join(evidenceDirectory, file), 'utf8'))),
      );
      const resultItems = await fixture.runtime.agentDataset.listExperimentResults({
        experimentId: agent.experimentId,
        page: 0,
        perPage: 100,
      });
      expect(
        resultItems.results.every(result => {
          const output = result.output as { text?: unknown };
          if (typeof output?.text !== 'string' || !output.text) return false;
          const normalized = JSON.parse(output.text) as { status?: unknown; metadata?: { correlationId?: unknown } };
          return typeof normalized.status === 'string' && typeof normalized.metadata?.correlationId === 'string';
        }),
      ).toBe(true);
      expect(
        persistedEvidence.every(
          evidence =>
            evidence.experimentId === agent.experimentId &&
            typeof evidence.correlationId === 'string' &&
            resultItems.results.some(
              result =>
                result.itemId === evidence.itemId &&
                (result.groundTruth as { id: string }).id === evidence.evaluationCaseId,
            ),
        ),
      ).toBe(true);
      const firstEvidenceFile = evidenceFiles[0]!;
      const firstEvidencePath = join(evidenceDirectory, firstEvidenceFile);
      const firstEvidence = await readFile(firstEvidencePath, 'utf8');
      const firstCaseId = (JSON.parse(firstEvidence) as { evaluationCaseId: string }).evaluationCaseId;
      await rm(firstEvidencePath);
      expect(
        (await nativeAgentEvaluationReport(fixture.runtime, agent.experimentId)).cases.find(
          item => item.id === firstCaseId,
        ),
      ).toMatchObject({
        failure: 'generation',
      });
      await writeFile(firstEvidencePath, firstEvidence);
      await writeFile(join(evidenceDirectory, `duplicate-${firstEvidenceFile}`), firstEvidence);
      expect(
        (await nativeAgentEvaluationReport(fixture.runtime, agent.experimentId)).cases.find(
          item => item.id === firstCaseId,
        ),
      ).toMatchObject({
        failure: 'generation',
      });
      await rm(join(evidenceDirectory, `duplicate-${firstEvidenceFile}`));
      const byQuestion = new Map(
        EVALUATION_CASES.map(evaluationCase => [
          evaluationCase.question,
          persistedEvidence.find(item => item.evaluationCaseId === evaluationCase.id)!,
        ]),
      );
      const legacy = await evaluateInstitutionalKnowledge({
        retrieve: async question =>
          byQuestion.get(question)!.observation.evidence.map(item => ({
            metadata: { recordId: item.recordId, locator: item.locator, sourceId: item.sourceId },
            content: item.content,
          })),
        answer: async question => byQuestion.get(question)!.observation.answer,
        judge: async ({ evaluationCase }) => byQuestion.get(evaluationCase.question)!.judge,
      });
      expect(persistedReport.aggregates).toEqual(legacy.aggregates);
      for (const report of [persistedReport, legacy]) {
        expect(report.cases.find(item => item.id === 'a02-docx-table')).toMatchObject({
          supportedClaims: 7,
          totalClaims: 10,
        });
        expect(report.cases.find(item => item.id === 'p01-retention-paraphrase')).toMatchObject({ consistent: false });
      }
      const first = await runNativeExperiment(fixture.runtime, {
        family: 'retrieval',
        version: seeded.retrievalVersion,
      });
      const retrievalItems = await fixture.runtime.retrievalDataset.listItems({ version: seeded.retrievalVersion });
      const retrievalItem = (Array.isArray(retrievalItems) ? retrievalItems : retrievalItems.items)[0]!;
      await fixture.runtime.retrievalDataset.updateItem({
        itemId: retrievalItem.id,
        input: { question: `${String((retrievalItem.input as { question: string }).question)} (comparison revision)` },
        groundTruth: retrievalItem.groundTruth ?? {},
        metadata: retrievalItem.metadata ?? {},
      });
      const second = await runNativeExperiment(fixture.runtime, {
        family: 'retrieval',
        version: (await fixture.runtime.retrievalDataset.getDetails()).version,
      });
      const comparison = await inspectNativeExperiments(fixture.runtime, [first.experimentId, second.experimentId]);
      expect(comparison.items).toHaveLength(EVALUATION_CASES.length);
      expect(comparison.experiments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: first.experimentId,
            datasetVersion: seeded.retrievalVersion,
            metadata: expect.objectContaining({ concurrency: 1, maxRetries: 0, maxCases: 30 }),
          }),
          expect.objectContaining({
            id: second.experimentId,
            datasetVersion: (await fixture.runtime.retrievalDataset.getDetails()).version,
            metadata: expect.objectContaining({ concurrency: 1, maxRetries: 0, maxCases: 30 }),
          }),
        ]),
      );
      await fixture.runtime.close();
      expect(
        await inspectPersistedExperiments(fixture.runtime.stateDirectory, [first.experimentId, second.experimentId]),
      ).toMatchObject({ items: expect.any(Array) });
    } finally {
      await fixture.close();
    }
  });
});
