import { describe, expect, it } from 'vitest';

import type { OrganizationAnswer } from '../../../src/mastra/answers/schema.js';
import { seedExperimentDatasets } from '../../../src/mastra/evaluation/datasets.js';
import { runNativeExperiment } from '../../../src/mastra/evaluation/experiments.js';
import { EVALUATION_CASES } from '../../../src/mastra/evaluation/fixtures/cases.js';
import { calibrationSummary, nativeRetrievalSummary } from '../../../src/mastra/evaluation/reports.js';
import { createEvaluationExperimentRuntime } from '../../../src/mastra/evaluation/runtime.js';
import { answerModel } from './helpers/answer-model.js';

import { judge, openRuntime } from './helpers/runtime.js';

describe('Native comparable experiments', () => {
  it('workflow experiments measure retrieval independently', async () => {
    const fixture = await openRuntime();
    try {
      const seeded = await seedExperimentDatasets(fixture.runtime);
      const run = await runNativeExperiment(fixture.runtime, { family: 'retrieval', version: seeded.retrievalVersion });
      expect(run).toMatchObject({ status: 'completed', storageComplete: true });
      expect(fixture.runtime.observations.size).toBe(0);
      expect(fixture.counters).toMatchObject({ answer: 0, judge: 0 });
      const results = await fixture.runtime.retrievalDataset.listExperimentResults({
        experimentId: run.experimentId,
        page: 0,
        perPage: 100,
      });
      const answerable = results.results.find(
        result => (result.groundTruth as { id: string }).id === 'a01-markdown-retention',
      )!;
      const output = answerable.output as {
        hits: Array<{ metadata?: { recordId?: string; sourceId?: string } }>;
        sources: Array<{ sourceId: string; ready: boolean }>;
      };
      expect(output.hits.some(hit => hit.metadata?.recordId === EVALUATION_CASES[0]!.requiredRecordIds[0])).toBe(true);
      expect(output.sources).toEqual(
        expect.arrayContaining([expect.objectContaining({ sourceId: 'local-eval', ready: true })]),
      );
      expect(await nativeRetrievalSummary(fixture.runtime, run.experimentId)).toMatchObject({
        experimentId: run.experimentId,
        cases: expect.arrayContaining([
          expect.objectContaining({ id: 'a01-markdown-retention', requiredRecordRecallAt6: 1, outcome: 'retrieved' }),
        ]),
      });

      const originalSearch = fixture.runtime.index.search.bind(fixture.runtime.index);
      const mutableIndex = fixture.runtime.index as unknown as { search: typeof fixture.runtime.index.search };
      mutableIndex.search = async () => [];
      const empty = await runNativeExperiment(fixture.runtime, {
        family: 'retrieval',
        version: seeded.retrievalVersion,
      });
      mutableIndex.search = originalSearch;
      const emptyResults = await fixture.runtime.retrievalDataset.listExperimentResults({
        experimentId: empty.experimentId,
        page: 0,
        perPage: 100,
      });
      expect((emptyResults.results[0]!.output as { hits: unknown[] }).hits).toEqual([]);
      expect(emptyResults.results.every(result => !result.error)).toBe(true);
      expect(await nativeRetrievalSummary(fixture.runtime, empty.experimentId)).toMatchObject({
        cases: expect.arrayContaining([expect.objectContaining({ outcome: 'empty' })]),
      });

      mutableIndex.search = async () => {
        throw new Error('controlled retrieval failure');
      };
      await expect(
        runNativeExperiment(fixture.runtime, { family: 'retrieval', version: seeded.retrievalVersion }),
      ).rejects.toThrow('result storage was incomplete');
      mutableIndex.search = originalSearch;
      const experiments = await fixture.runtime.retrievalDataset.listExperiments({ page: 0, perPage: 100 });
      const failed = await fixture.runtime.retrievalDataset.listExperimentResults({
        experimentId: experiments.experiments[0]!.id,
        page: 0,
        perPage: 100,
      });
      expect(failed.results[0]?.error).toBeTruthy();
      expect(await nativeRetrievalSummary(fixture.runtime, experiments.experiments[0]!.id)).toMatchObject({
        cases: expect.arrayContaining([expect.objectContaining({ outcome: 'failed' })]),
      });
      expect(fixture.counters).toMatchObject({ answer: 0, judge: 0 });
    } finally {
      await fixture.close();
    }
  });

  it('scorer experiments expose authored label disagreement', async () => {
    const calls: OrganizationAnswer[] = [];
    const deliveredEvidence: Array<Array<{ content: string }>> = [];
    const fixture = await openRuntime({
      judge: async input => {
        deliveredEvidence.push(input.evidence);
        return judge(input);
      },
    });
    try {
      const seeded = await seedExperimentDatasets(fixture.runtime);
      const run = await runNativeExperiment(fixture.runtime, {
        family: 'calibration',
        version: seeded.calibrationVersion,
      });
      const results = await fixture.runtime.calibrationDataset.listExperimentResults({
        experimentId: run.experimentId,
        page: 0,
        perPage: 100,
      });
      for (const result of results.results) calls.push((result.input as { answer: OrganizationAnswer }).answer);
      expect(run).toMatchObject({ status: 'completed', storageComplete: true });
      expect(calls).toHaveLength(4);
      expect(calls.find(candidate => candidate.answer.includes('chief executive'))?.status).toBe('answered');
      expect(calls.find(candidate => candidate.answer.includes('fabricated'))?.citations[0]?.recordId).toBe(
        'fabricated-record',
      );
      expect(
        results.results
          .map(result => result.input as { evidence: Array<{ recordId: string; content: string }> })
          .every(candidate => candidate.evidence.length === 1 && (candidate.evidence[0]?.content.length ?? 0) > 0),
      ).toBe(true);
      expect(deliveredEvidence).toHaveLength(4);
      expect(deliveredEvidence.flat().map(item => item.content)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('seven years'),
          expect.stringContaining('records staff'),
          expect.stringContaining('Untrusted document instruction'),
        ]),
      );
      expect(await calibrationSummary(fixture.runtime, run.experimentId)).toMatchObject({
        agreement: 0.75,
        cases: expect.arrayContaining([expect.objectContaining({ id: 'a02-docx-table', disagreement: true })]),
      });
    } finally {
      await fixture.close();
    }
    const invalid = await openRuntime({
      judge: async () =>
        ({
          supportedClaims: 0,
          totalClaims: 0,
          supportedFactIds: ['not-an-authored-fact'],
          unauthorizedBehavior: false,
        }) as never,
    });
    try {
      const seeded = await seedExperimentDatasets(invalid.runtime);
      let invalidExperimentId: string | undefined;
      await expect(
        runNativeExperiment(invalid.runtime, {
          family: 'calibration',
          version: seeded.calibrationVersion,
          onExperimentCreated: experiment => {
            invalidExperimentId = experiment.id;
          },
        }),
      ).rejects.toThrow('storage was incomplete');
      expect(invalidExperimentId).toBeDefined();
      const invalidResults = await invalid.runtime.calibrationDataset.listExperimentResults({
        experimentId: invalidExperimentId!,
        page: 0,
        perPage: 100,
      });
      expect(JSON.stringify(invalidResults.results)).toContain('Groundedness scorer failed.');
    } finally {
      await invalid.close();
    }

    const privateJudgeFailure = 'synthetic-provider-secret-do-not-persist';
    const privateFailure = await openRuntime({
      judge: async () => {
        throw new Error(privateJudgeFailure);
      },
    });
    try {
      const seeded = await seedExperimentDatasets(privateFailure.runtime);
      let privateExperimentId: string | undefined;
      await expect(
        runNativeExperiment(privateFailure.runtime, {
          family: 'calibration',
          version: seeded.calibrationVersion,
          onExperimentCreated: experiment => {
            privateExperimentId = experiment.id;
          },
        }),
      ).rejects.toThrow('storage was incomplete');
      const results = await privateFailure.runtime.calibrationDataset.listExperimentResults({
        experimentId: privateExperimentId!,
        page: 0,
        perPage: 100,
      });
      const scores = await privateFailure.runtime.storage
        .getStore('scores')
        .then(store =>
          store?.listScoresByRunId({ runId: privateExperimentId!, pagination: { page: 0, perPage: 100 } }),
        );
      const persisted = JSON.stringify({ results: results.results, scores });
      expect(persisted).not.toContain(privateJudgeFailure);
      expect(persisted).toContain('Groundedness scorer failed.');
    } finally {
      await privateFailure.close();
    }
  });

  it('experiment failures preserve evidence without automatic retry', async () => {
    let answerDispatches = 0;
    const answerUsage: Array<{ inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined> = [];
    const fixture = await openRuntime({
      onAnswerDispatch: () => {
        answerDispatches++;
      },
      onAnswerUsage: usage => {
        answerUsage.push(usage);
      },
    });
    try {
      const seeded = await seedExperimentDatasets(fixture.runtime);
      await expect(
        runNativeExperiment(fixture.runtime, {
          family: 'retrieval',
          version: seeded.retrievalVersion,
          interruptAfter: 1,
        }),
      ).rejects.toThrow('Experiment interrupted');
      const experiments = await fixture.runtime.retrievalDataset.listExperiments({ page: 0, perPage: 100 });
      expect(experiments.experiments[0]).toMatchObject({ status: 'running' });
      const interrupted = await fixture.runtime.retrievalDataset.listExperimentResults({
        experimentId: experiments.experiments[0]!.id,
        page: 0,
        perPage: 100,
      });
      expect(interrupted.results).toHaveLength(1);
      const interruptedExperimentId = experiments.experiments[0]!.id;
      await fixture.runtime.close();
      fixture.runtime = await createEvaluationExperimentRuntime({
        stateDirectory: fixture.runtime.stateDirectory,
        index: fixture.runtime.index,
        answerModel: answerModel({
          onCall: request => {
            fixture.counters.answer++;
            fixture.counters.answerRequests.push(request);
            fixture.counters.prompts.push(request.prompt);
          },
        }) as never,
        fixtureVersion: seeded.fixtureVersion,
        provenance: {
          indexSnapshotVersion: fixture.runtime.index.lastRun()!.runId,
          answerModel: 'controlled-test-model',
          judgeModel: 'controlled-test-judge',
          rubricVersion: 'test-rubric-v1',
        },
        judge: async input => {
          fixture.counters.judge++;
          return judge(input);
        },
        onAnswerDispatch: () => {
          answerDispatches++;
        },
        onAnswerUsage: usage => {
          answerUsage.push(usage);
        },
      });
      const reopened = await fixture.runtime.retrievalDataset.listExperimentResults({
        experimentId: interruptedExperimentId,
        page: 0,
        perPage: 100,
      });
      expect(reopened.results).toHaveLength(1);
      expect(
        (await fixture.runtime.retrievalDataset.listExperiments({ page: 0, perPage: 100 })).experiments.find(
          experiment => experiment.id === interruptedExperimentId,
        ),
      ).toMatchObject({ status: 'running' });
      let releaseFirst: (() => void) | undefined;
      let firstPersisted!: () => void;
      let pause = true;
      const firstPersistedPromise = new Promise<void>(resolve => {
        firstPersisted = resolve;
      });
      const active = runNativeExperiment(fixture.runtime, {
        family: 'retrieval',
        version: seeded.retrievalVersion,
        onItemPersisted: async () => {
          if (!pause) return;
          pause = false;
          firstPersisted();
          await new Promise<void>(resolve => {
            releaseFirst = resolve;
          });
        },
      });
      await firstPersistedPromise;
      await expect(
        runNativeExperiment(fixture.runtime, { family: 'retrieval', version: seeded.retrievalVersion }),
      ).rejects.toThrow('already active');
      releaseFirst?.();
      await expect(active).resolves.toMatchObject({ status: 'completed' });
      const explicitReplacement = await runNativeExperiment(fixture.runtime, {
        family: 'retrieval',
        version: seeded.retrievalVersion,
      });
      expect(explicitReplacement).toMatchObject({ status: 'completed' });
      expect(explicitReplacement.experimentId).not.toBe(interruptedExperimentId);

      const originalList = fixture.runtime.retrievalDataset.listExperimentResults.bind(
        fixture.runtime.retrievalDataset,
      );
      const mutableDataset = fixture.runtime.retrievalDataset as unknown as {
        listExperimentResults: typeof fixture.runtime.retrievalDataset.listExperimentResults;
      };
      mutableDataset.listExperimentResults = async input => {
        const persisted = await originalList(input);
        return { ...persisted, results: [] };
      };
      await expect(
        runNativeExperiment(fixture.runtime, { family: 'retrieval', version: seeded.retrievalVersion }),
      ).rejects.toThrow('result storage was incomplete');
      mutableDataset.listExperimentResults = originalList;

      const originalScoreList = (await fixture.runtime.storage.getStore('scores'))!.listScoresByRunId.bind(
        (await fixture.runtime.storage.getStore('scores'))!,
      );
      const scores = (await fixture.runtime.storage.getStore('scores'))!;
      scores.listScoresByRunId = async () => ({
        scores: [],
        pagination: { page: 0, perPage: 100, total: 0, hasMore: false },
      });
      const beforeScoreFailure = { ...fixture.counters };
      let partialExperiment: { id: string; datasetVersion: number } | undefined;
      const partialDispatches: string[] = [];
      await expect(
        runNativeExperiment(fixture.runtime, {
          family: 'agent',
          version: seeded.agentVersion,
          onExperimentCreated: experiment => {
            partialExperiment = experiment;
          },
          onItemDispatched: itemId => {
            partialDispatches.push(itemId);
          },
        }),
      ).rejects.toThrow('score storage was incomplete');
      scores.listScoresByRunId = originalScoreList;
      expect(partialExperiment).toBeDefined();
      expect(partialExperiment).toEqual(expect.objectContaining({ id: expect.any(String) }));
      expect(partialDispatches).toHaveLength(1);
      expect(answerDispatches).toBe(1);
      expect(answerUsage).toEqual([{ inputTokens: 1, outputTokens: 1, totalTokens: 2 }]);
      expect(fixture.counters.answer - beforeScoreFailure.answer).toBe(1);
      expect(fixture.counters.judge - beforeScoreFailure.judge).toBe(1);
    } finally {
      await fixture.close();
    }
  });
});
