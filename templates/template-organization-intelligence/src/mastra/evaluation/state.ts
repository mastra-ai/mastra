import { mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import type { GroundedAnswerObservation } from '../answers/schema.js';
import { loadCatalog } from '../workspaces/catalog.js';
import type { JudgeResult } from './evaluation.js';

import { LEASE_DIRECTORY } from './limits.js';

function casePath(stateDirectory: string, correlationId: string): string {
  return resolve(stateDirectory, 'experiment-cases', `${correlationId}.json`);
}

export async function persistCaseEvidence(
  stateDirectory: string,
  binding: { experimentId: string; itemId: string; evaluationCaseId: string },
  observation: GroundedAnswerObservation,
  judge: JudgeResult,
): Promise<void> {
  const path = casePath(stateDirectory, observation.answer.metadata.correlationId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    JSON.stringify(
      { ...binding, correlationId: observation.answer.metadata.correlationId, observation, judge },
      null,
      2,
    ) + '\n',
  );
}

async function readCaseEvidence(stateDirectory: string, correlationId: string) {
  try {
    return JSON.parse(await readFile(casePath(stateDirectory, correlationId), 'utf8')) as {
      experimentId?: string;
      itemId?: string;
      evaluationCaseId?: string;
      correlationId?: string;
      observation: GroundedAnswerObservation;
      judge: JudgeResult;
    };
  } catch {
    return undefined;
  }
}

export async function persistedCaseEvidenceByEvaluationCase(stateDirectory: string) {
  try {
    const entries = await readdir(resolve(stateDirectory, 'experiment-cases'));
    const cases = await Promise.all(
      entries.map(entry => readCaseEvidence(stateDirectory, entry.replace(/\.json$/, ''))),
    );
    return cases.filter((item): item is NonNullable<typeof item> => item?.evaluationCaseId !== undefined);
  } catch {
    return [] as NonNullable<Awaited<ReturnType<typeof readCaseEvidence>>>[];
  }
}

async function canonicalPath(path: string): Promise<string> {
  const resolved = resolve(path);
  let current = resolved;
  const missing: string[] = [];
  for (;;) {
    try {
      const actual = await realpath(current);
      return resolve(actual, ...missing.reverse());
    } catch {
      const parent = dirname(current);
      if (parent === current) return resolved;
      missing.push(current.slice(parent.length + (parent.endsWith('/') ? 0 : 1)));
      current = parent;
    }
  }
}

function overlaps(left: string, right: string): boolean {
  const relation = relative(left, right);
  return relation === '' || (!relation.startsWith('..') && !relation.includes('/../'));
}

/** Reject aliases before fixture creation or any provider-facing setup. */
export async function assertIsolatedEvaluationState(stateDirectory: string, protectedPaths: string[]): Promise<string> {
  const state = await canonicalPath(stateDirectory);
  for (const protectedPath of protectedPaths) {
    const protectedRealPath = await canonicalPath(protectedPath);
    if (overlaps(state, protectedRealPath) || overlaps(protectedRealPath, state))
      throw new Error('Evaluation state must not overlap operational state or an operational source root.');
  }
  return state;
}

/** Reads local catalog roots only, without creating sources, workers, schedules, or provider clients. */
export async function operationalEvaluationExclusions(projectRoot: string): Promise<string[]> {
  const root = resolve(projectRoot);
  const catalog = await loadCatalog(resolve(root, 'source-catalog.json'));
  return [
    resolve(root, '.mastra'),
    ...catalog.sources.filter(source => source.provider === 'local').map(source => source.root),
  ];
}

export async function acquireEvaluationLease(stateDirectory: string): Promise<() => Promise<void>> {
  const lease = resolve(stateDirectory, LEASE_DIRECTORY);
  try {
    await mkdir(lease);
  } catch {
    throw new Error('An evaluation run is already active for this state directory.');
  }
  return () => rm(lease, { recursive: true, force: true });
}
