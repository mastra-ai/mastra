import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const collapseFixtureDir = join(
  __dirname,
  '..',
  '__fixtures__',
  'repro-captures',
  'collapse-to-0p3k-step23-1772668741183',
);

const driftActivationFixtureDir = join(
  __dirname,
  '..',
  '__fixtures__',
  'repro-captures',
  'drift-activation-step19-1772672074104',
);

function getSortedStepDirs() {
  return readdirSync(collapseFixtureDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort(
      (a, b) => Number(a.split('-step-')[1]?.split('-')[0] ?? 0) - Number(b.split('-step-')[1]?.split('-')[0] ?? 0),
    );
}

describe('Repro fixture integrity (static capture assertions)', () => {
  it('should preserve captured observed/removal mismatch for collapse-to-0p3k fixture', () => {
    const stepDirs = getSortedStepDirs();
    const mismatches: Array<{
      stepDir: string;
      extraRemoved: string[];
      missingObservedStillPresent: string[];
    }> = [];

    for (const stepDir of stepDirs) {
      const outputPath = join(collapseFixtureDir, stepDir, 'output.json');
      const preStatePath = join(collapseFixtureDir, stepDir, 'pre-state.json');
      const postStatePath = join(collapseFixtureDir, stepDir, 'post-state.json');

      const output = JSON.parse(readFileSync(outputPath, 'utf8'));
      const details = output?.details;
      if (!details?.thresholdReached || !details?.thresholdCleanup) {
        continue;
      }

      const observedIds = Array.isArray(details.thresholdCleanup.observedIds)
        ? details.thresholdCleanup.observedIds
        : [];
      const observedSet = new Set<string>(observedIds);

      const preState = JSON.parse(readFileSync(preStatePath, 'utf8'));
      const postState = JSON.parse(readFileSync(postStatePath, 'utf8'));
      const preIds = new Set<string>((preState?.messages ?? []).map((m: { id: string }) => m.id));
      const postIds = new Set<string>((postState?.messages ?? []).map((m: { id: string }) => m.id));

      const removed = [...preIds].filter(id => !postIds.has(id));
      const extraRemoved = removed.filter(id => !observedSet.has(id));
      const missingObservedStillPresent = observedIds.filter((id: string) => postIds.has(id));

      if (extraRemoved.length > 0 || missingObservedStillPresent.length > 0) {
        mismatches.push({ stepDir, extraRemoved, missingObservedStillPresent });
      }
    }

    expect(mismatches).toEqual([
      {
        stepDir: '1772668823377-step-23-97fbc5ab-b157-4eba-9834-3bd9dbeaf7a5',
        extraRemoved: ['3cbd4141-a393-48c9-a668-b666fb9dfd8a'],
        missingObservedStillPresent: ['e56b73d0-1b99-4709-aa0f-4dcf9ccf3efd'],
      },
    ]);
  });

  it('should preserve captured minRemaining floor violation for collapse-to-0p3k fixture', () => {
    const stepDirs = getSortedStepDirs();
    const thresholdViolations: Array<{ stepDir: string; postTokens: number; minRemaining: number }> = [];

    for (const stepDir of stepDirs) {
      const outputPath = join(collapseFixtureDir, stepDir, 'output.json');
      const postStatePath = join(collapseFixtureDir, stepDir, 'post-state.json');

      const output = JSON.parse(readFileSync(outputPath, 'utf8'));
      const details = output?.details;
      if (
        !details?.thresholdReached ||
        !details?.thresholdCleanup ||
        typeof details?.thresholdCleanup?.minRemaining !== 'number'
      ) {
        continue;
      }

      const postState = JSON.parse(readFileSync(postStatePath, 'utf8'));
      const postTokens = Number(postState?.contextTokenCount ?? 0);
      const minRemaining = Number(details.thresholdCleanup.minRemaining);

      if (postTokens < minRemaining) {
        thresholdViolations.push({ stepDir, postTokens, minRemaining });
      }
    }

    expect(thresholdViolations).toEqual([
      {
        stepDir: '1772668823377-step-23-97fbc5ab-b157-4eba-9834-3bd9dbeaf7a5',
        postTokens: 259,
        minRemaining: 2000,
      },
    ]);
  });

  it('should preserve captured observed/removal drift for drift-activation fixtures', () => {
    const stepDirs = [
      '1772672120257-step-19-ea45a54a-d20d-411c-991b-c68ee6ad75b9',
      '1772672195793-step-39-e8e8b889-5c2b-4ecc-92dd-e5abf1ce0308',
    ];

    const mismatches = stepDirs.map(stepDir => {
      const output = JSON.parse(readFileSync(join(driftActivationFixtureDir, stepDir, 'output.json'), 'utf8'));
      const preState = JSON.parse(readFileSync(join(driftActivationFixtureDir, stepDir, 'pre-state.json'), 'utf8'));
      const postState = JSON.parse(readFileSync(join(driftActivationFixtureDir, stepDir, 'post-state.json'), 'utf8'));

      const observedIds = Array.isArray(output?.details?.thresholdCleanup?.observedIds)
        ? output.details.thresholdCleanup.observedIds
        : [];
      const observedSet = new Set<string>(observedIds);
      const preIds = new Set<string>((preState?.messages ?? []).map((m: { id: string }) => m.id));
      const postIds = new Set<string>((postState?.messages ?? []).map((m: { id: string }) => m.id));
      const removed = [...preIds].filter(id => !postIds.has(id));

      return {
        stepDir,
        extraRemoved: removed.filter(id => !observedSet.has(id)),
        missingObservedStillPresent: observedIds.filter((id: string) => postIds.has(id)),
      };
    });

    expect(mismatches).toEqual([
      {
        stepDir: '1772672120257-step-19-ea45a54a-d20d-411c-991b-c68ee6ad75b9',
        extraRemoved: ['80b087b0-5ba5-4f10-a984-88f61950e27e'],
        missingObservedStillPresent: ['609847ab-9306-40e2-9418-2f978e3ed794'],
      },
      {
        stepDir: '1772672195793-step-39-e8e8b889-5c2b-4ecc-92dd-e5abf1ce0308',
        extraRemoved: [],
        missingObservedStillPresent: ['609847ab-9306-40e2-9418-2f978e3ed794'],
      },
    ]);
  });
});
