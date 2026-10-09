import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { seedExperimentDatasets } from '../../../src/mastra/evaluation/datasets.js';
import { runNativeExperiment } from '../../../src/mastra/evaluation/experiments.js';
import { inspectPersistedExperiments } from '../../../src/mastra/evaluation/reports.js';
import {
  assertIsolatedEvaluationState,
  operationalEvaluationExclusions,
} from '../../../src/mastra/evaluation/state.js';

import { evaluationRunnerFixture } from './helpers/evaluation-runner-fixture.js';
import { openRuntime } from './helpers/runtime.js';

const execFileAsync = promisify(execFile);

async function createOperationalProject(directory: string): Promise<string> {
  const documents = join(directory, 'documents');
  await mkdir(documents);
  await writeFile(
    join(directory, 'source-catalog.json'),
    JSON.stringify({
      version: 1,
      sources: [{ id: 'local', provider: 'local', mountPath: '/local', root: './documents', enabled: true }],
    }),
  );
  return realpath(documents);
}

describe('Native comparable experiments', () => {
  it('experiments preserve isolation and explicit call budgets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'organization-experiment-boundary-'));
    try {
      const operational = join(root, 'operational');
      await mkdir(operational);
      await expect(assertIsolatedEvaluationState(operational, [operational])).rejects.toThrow('must not overlap');
      await symlink(operational, join(root, 'alias'));
      await expect(assertIsolatedEvaluationState(join(root, 'alias'), [operational])).rejects.toThrow(
        'must not overlap',
      );
      const sourceRoot = await createOperationalProject(root);
      const exclusions = await operationalEvaluationExclusions(root);
      expect(exclusions).toContain(sourceRoot);
      await expect(assertIsolatedEvaluationState(sourceRoot, exclusions)).rejects.toThrow('must not overlap');
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    const fixture = await openRuntime();
    try {
      const baselineTelemetry = await fixture.runtime.index.telemetry.summary();
      const seeded = await seedExperimentDatasets(fixture.runtime);
      expect(seeded.fixtureVersion).toMatch(/^[a-f0-9]{64}$/);
      expect(fixture.counters).toMatchObject({ answer: 0, judge: 0 });
      expect(await fixture.runtime.index.telemetry.summary()).toEqual(baselineTelemetry);
      await fixture.runtime.close();
      await expect(
        inspectPersistedExperiments(fixture.runtime.stateDirectory, ['missing-one', 'missing-two']),
      ).rejects.toThrow();
      expect(fixture.counters).toMatchObject({ answer: 0, judge: 0 });
      expect(await fixture.runtime.index.telemetry.summary()).toEqual(baselineTelemetry);
    } finally {
      await fixture.close();
    }

    await expect(
      execFileAsync(process.execPath, ['scripts/evaluation-studio.mjs', '--', '--state-dir=-invalid'], {
        cwd: process.cwd(),
      }),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('Pass --state-dir') });

    const cliRoot = await mkdtemp(join(tmpdir(), 'organization-evaluation-cli-lease-'));
    try {
      await createOperationalProject(cliRoot);
      const stateDirectory = join(cliRoot, 'state');
      const runner = join(process.cwd(), 'build', 'eval', 'mastra', 'evaluation', 'eval-runner.js');
      const { OPENAI_API_KEY: _key, ...withoutKey } = process.env;
      await execFileAsync(process.execPath, [runner, '--mode', 'seed', '--state-dir', stateDirectory], {
        cwd: cliRoot,
        env: withoutKey,
      });
      const sentinel = '{"preserve":"byte-for-byte"}\n';
      const reportPath = join(stateDirectory, 'evaluation-report.json');
      await writeFile(reportPath, sentinel);
      await mkdir(join(stateDirectory, '.organization-evaluation-run'));
      await expect(
        execFileAsync(process.execPath, [runner, '--mode', 'seed', '--state-dir', stateDirectory], {
          cwd: cliRoot,
          env: withoutKey,
        }),
      ).rejects.toMatchObject({ code: 1 });
      expect(await readFile(reportPath, 'utf8')).toBe(sentinel);
      await rm(join(stateDirectory, '.organization-evaluation-run'), { recursive: true, force: true });

      const persisted = await openRuntime({ stateDirectory });
      let firstRetrieval: string;
      let secondRetrieval: string;
      try {
        const seeded = await seedExperimentDatasets(persisted.runtime);
        await runNativeExperiment(persisted.runtime, { family: 'agent', version: seeded.agentVersion });
        firstRetrieval = (
          await runNativeExperiment(persisted.runtime, { family: 'retrieval', version: seeded.retrievalVersion })
        ).experimentId;
        secondRetrieval = (
          await runNativeExperiment(persisted.runtime, { family: 'retrieval', version: seeded.retrievalVersion })
        ).experimentId;
      } finally {
        await persisted.close();
      }

      await execFileAsync(process.execPath, [runner, '--mode', 'seed', '--state-dir', stateDirectory], {
        cwd: cliRoot,
        env: withoutKey,
      });
      const firstSequentialReport = JSON.parse(await readFile(reportPath, 'utf8')) as {
        settings: { answerCalls: number; mode: string; usage: { answers: unknown } };
      };
      expect(firstSequentialReport.settings).toMatchObject({
        answerCalls: 0,
        mode: 'seed',
        usage: { answers: 'unavailable' },
      });
      const reportBeforeInspect = await readFile(reportPath, 'utf8');
      const inspection = await execFileAsync(
        process.execPath,
        [
          runner,
          '--mode',
          'inspect',
          '--state-dir',
          stateDirectory,
          '--experiment-id',
          firstRetrieval!,
          '--experiment-id',
          secondRetrieval!,
        ],
        { cwd: cliRoot, env: withoutKey },
      );
      const comparison = JSON.parse(inspection.stdout) as unknown;
      expect(JSON.stringify(comparison)).toContain(firstRetrieval!);
      expect(JSON.stringify(comparison)).toContain(secondRetrieval!);
      expect(await readFile(reportPath, 'utf8')).toBe(reportBeforeInspect);
      await execFileAsync(process.execPath, [runner, '--mode', 'seed', '--state-dir', stateDirectory], {
        cwd: cliRoot,
        env: withoutKey,
      });
      const secondSequentialReport = JSON.parse(await readFile(reportPath, 'utf8')) as {
        settings: { answerCalls: number; mode: string; usage: { answers: unknown } };
      };
      expect(secondSequentialReport.settings).toMatchObject({
        answerCalls: 0,
        mode: 'seed',
        usage: { answers: 'unavailable' },
      });

      const success = await evaluationRunnerFixture(cliRoot, 'success');
      const successState = join(cliRoot, 'runner-success');
      await expect(
        execFileAsync(process.execPath, [runner, '--allow-live', '--mode', 'agent', '--state-dir', successState], {
          cwd: cliRoot,
          env: success.env,
        }),
      ).rejects.toMatchObject({ code: 1 });
      const agentReport = JSON.parse(await readFile(join(successState, 'evaluation-report.json'), 'utf8')) as {
        settings: { answerCalls: number; judgeCalls: number; usage: { answers: unknown; judges: unknown } };
      };
      expect(agentReport.settings).toMatchObject({
        answerCalls: 30,
        judgeCalls: 30,
        usage: {
          answers: { inputTokens: 90, outputTokens: 120, totalTokens: 210 },
          judges: { inputTokens: 90, outputTokens: 120, totalTokens: 210 },
        },
      });
      await execFileAsync(
        process.execPath,
        [runner, '--allow-live', '--mode', 'calibration', '--state-dir', successState],
        {
          cwd: cliRoot,
          env: success.env,
        },
      );
      const calibrationReport = JSON.parse(await readFile(join(successState, 'evaluation-report.json'), 'utf8')) as {
        settings: { answerCalls: number; judgeCalls: number; usage: { answers: unknown; judges: unknown } };
      };
      expect(calibrationReport.settings).toMatchObject({
        answerCalls: 0,
        judgeCalls: 4,
        usage: { answers: 'unavailable', judges: { inputTokens: 12, outputTokens: 16, totalTokens: 28 } },
      });
      const successRequests = (await readFile(success.log, 'utf8'))
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { body: Record<string, unknown>; path: string });
      const modelRequests = successRequests.filter(request => !request.path.endsWith('/embeddings'));
      expect(modelRequests).toHaveLength(64);
      expect(
        modelRequests.every(
          request =>
            request.body.max_output_tokens === 4096 ||
            request.body.max_completion_tokens === 4096 ||
            request.body.max_tokens === 4096,
        ),
      ).toBe(true);

      const retryableAnswer = await evaluationRunnerFixture(cliRoot, 'retryable-answer');
      const retryableAnswerState = join(cliRoot, 'runner-retryable-answer');
      await expect(
        execFileAsync(
          process.execPath,
          [runner, '--allow-live', '--mode', 'agent', '--state-dir', retryableAnswerState],
          {
            cwd: cliRoot,
            env: retryableAnswer.env,
          },
        ),
      ).rejects.toMatchObject({ code: 1 });
      expect(JSON.parse(await readFile(join(retryableAnswerState, 'evaluation-report.json'), 'utf8'))).toMatchObject({
        failure: { stage: 'cases' },
        settings: { answerCalls: 1, judgeCalls: 0, usage: { answers: 'partial' } },
      });
      const retryableAnswerRequests = (await readFile(retryableAnswer.log, 'utf8'))
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { path: string });
      expect(retryableAnswerRequests.filter(request => !request.path.endsWith('/embeddings'))).toHaveLength(1);

      const retryableJudge = await evaluationRunnerFixture(cliRoot, 'retryable-judge');
      const retryableJudgeState = join(cliRoot, 'runner-retryable-judge');
      await expect(
        execFileAsync(
          process.execPath,
          [runner, '--allow-live', '--mode', 'agent', '--state-dir', retryableJudgeState],
          {
            cwd: cliRoot,
            env: retryableJudge.env,
          },
        ),
      ).rejects.toMatchObject({ code: 1 });
      expect(JSON.parse(await readFile(join(retryableJudgeState, 'evaluation-report.json'), 'utf8'))).toMatchObject({
        failure: { stage: 'cases' },
        settings: { answerCalls: 1, judgeCalls: 1, usage: { judges: 'partial' } },
      });
      const retryableJudgeRequests = (await readFile(retryableJudge.log, 'utf8'))
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { path: string });
      expect(retryableJudgeRequests.filter(request => !request.path.endsWith('/embeddings'))).toHaveLength(2);

      const expired = await evaluationRunnerFixture(cliRoot, 'expired');
      const expiredState = join(cliRoot, 'runner-expired');
      await expect(
        execFileAsync(process.execPath, [runner, '--allow-live', '--mode', 'agent', '--state-dir', expiredState], {
          cwd: cliRoot,
          env: expired.env,
        }),
      ).rejects.toMatchObject({ code: 1 });
      const expiredReport = await readFile(join(expiredState, 'evaluation-report.json'), 'utf8');
      expect(expiredReport).not.toContain('fixture-key');
      expect(JSON.parse(expiredReport)).toMatchObject({
        failure: { stage: 'cases' },
        settings: { answerCalls: 1, judgeCalls: 0, usage: { answers: 'partial' } },
      });
      const expiredRequests = (await readFile(expired.log, 'utf8'))
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { path: string });
      expect(expiredRequests.filter(request => !request.path.endsWith('/embeddings'))).toHaveLength(1);

      const timedOut = await evaluationRunnerFixture(cliRoot, 'timeout');
      const timeoutState = join(cliRoot, 'runner-timeout');
      await expect(
        execFileAsync(process.execPath, [runner, '--allow-live', '--mode', 'retrieval', '--state-dir', timeoutState], {
          cwd: cliRoot,
          env: timedOut.env,
        }),
      ).rejects.toMatchObject({ code: expect.any(Number) });
      const timeoutReport = JSON.parse(await readFile(join(timeoutState, 'evaluation-report.json'), 'utf8')) as {
        failure: { stage: string };
        settings: { answerCalls: number; judgeCalls: number };
      };
      expect(timeoutReport).toMatchObject({
        failure: { stage: 'synchronization' },
        settings: { answerCalls: 0, judgeCalls: 0 },
      });
      const timeoutRequests = (await readFile(timedOut.log, 'utf8'))
        .trim()
        .split('\n')
        .map(line => JSON.parse(line) as { aborted?: boolean; path: string });
      expect(timeoutRequests).not.toHaveLength(0);
      expect(timeoutRequests.every(request => request.path === '/v1/embeddings')).toBe(true);
      expect(timeoutRequests.some(request => request.aborted === true)).toBe(true);

      const reportBeforeInvalidInspection = await readFile(reportPath, 'utf8');
      await expect(
        execFileAsync(
          process.execPath,
          [
            runner,
            '--mode',
            'inspect',
            '--state-dir',
            stateDirectory,
            '--experiment-id',
            'missing-one',
            '--experiment-id',
            'missing-two',
          ],
          { cwd: cliRoot, env: withoutKey },
        ),
      ).rejects.toMatchObject({ code: 1 });
      expect(await readFile(reportPath, 'utf8')).toBe(reportBeforeInvalidInspection);
    } finally {
      await rm(cliRoot, { recursive: true, force: true });
    }
  });
});
