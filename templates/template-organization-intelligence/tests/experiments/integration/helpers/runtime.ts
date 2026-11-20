import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import type { EvaluationJudge } from '../../../../src/mastra/evaluation/contracts.js';
import {
  createEvaluationRuntime,
  evaluationFixtureVersion,
} from '../../../../src/mastra/evaluation/fixtures/runtime.js';
import { createEvaluationExperimentRuntime } from '../../../../src/mastra/evaluation/runtime.js';
import { SourceIndex } from '../../../../src/mastra/workspaces/source-index.js';
import { answerModel } from './answer-model.js';

export const judge: EvaluationJudge = async ({ evaluationCase, answer }) => {
  const unsupported =
    answer.status === 'operational_error' ||
    evaluationCase.kind === 'malicious' ||
    answer.answer.includes('chief executive');
  const totalClaims = evaluationCase.kind === 'malicious' ? 0 : 1;
  return {
    supportedClaims: unsupported ? 0 : 1,
    totalClaims,
    supportedFactIds: unsupported ? [] : evaluationCase.requiredFacts.slice(0, 1),
    unauthorizedBehavior: false,
  };
};

export async function openRuntime(
  options: {
    answerError?: Error | (() => Error);
    judge?: EvaluationJudge;
    invalidAnswerFor?: string;
    onAnswerDispatch?: () => void;
    onAnswerUsage?: (usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined) => void;
    providerTimeoutMs?: number;
    stateDirectory?: string;
    waitForAnswerAbort?: boolean;
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'organization-experiment-'));
  const sources = await createEvaluationRuntime(join(root, 'fixtures'), {});
  const index = new SourceIndex({
    databaseUrl: `file:${join(root, 'synthetic-index.db')}`,
    sources,
    embed: async text => [Number(/invoice|retain|retention|kept/.test(text.toLowerCase())), 0.01],
  });
  await index.initialize();
  expect((await index.sync()).status).toBe('success');
  const counters = {
    answer: 0,
    answerRequests: [] as Array<{ abortSignal?: AbortSignal; maxOutputTokens?: number; prompt: string }>,
    judge: 0,
    prompts: [] as string[],
  };
  const runtime = await createEvaluationExperimentRuntime({
    stateDirectory: options.stateDirectory ?? join(root, 'experiments'),
    index,
    answerModel: answerModel({
      error: options.answerError,
      invalidFor: options.invalidAnswerFor,
      onCall: request => {
        counters.answer++;
        counters.answerRequests.push(request);
        counters.prompts.push(request.prompt);
      },
      waitForAbort: options.waitForAnswerAbort,
    }) as never,
    fixtureVersion: evaluationFixtureVersion(sources),
    provenance: {
      indexSnapshotVersion: index.lastRun()!.runId,
      answerModel: 'controlled-test-model',
      judgeModel: 'controlled-test-judge',
      rubricVersion: 'test-rubric-v1',
    },
    judge: async input => {
      counters.judge++;
      return (options.judge ?? judge)(input);
    },
    onAnswerDispatch: options.onAnswerDispatch,
    onAnswerUsage: options.onAnswerUsage,
    providerTimeoutMs: options.providerTimeoutMs,
  });
  return {
    root,
    runtime,
    counters,
    close: async () => {
      await runtime.close();
      await index.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
