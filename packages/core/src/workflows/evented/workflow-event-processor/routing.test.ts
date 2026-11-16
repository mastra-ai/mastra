import { describe, expect, it } from 'vitest';
import type { RestartExecutionParams, StepFlowEntry } from '../../types';
import { routeStepRun } from './routing';

// Routing reads only entry types and branch lists, so entries carry just those.
const single = (id: string) => ({ type: 'step', step: { id } }) as unknown as StepFlowEntry;
const right = single('right');
const branches = [single('left'), right];

const entries = {
  step: single('plain'),
  classifier: { type: 'classifier', id: 'sort', classifierId: 'sort' } as StepFlowEntry,
  loop: { type: 'loop', step: single('body') } as unknown as StepFlowEntry,
  sleep: { type: 'sleep', id: 'nap', duration: 1 } as StepFlowEntry,
  sleepUntil: { type: 'sleepUntil', id: 'until', date: new Date(0) } as StepFlowEntry,
  parallel: { type: 'parallel', steps: branches } as unknown as StepFlowEntry,
  conditional: { type: 'conditional', steps: branches } as unknown as StepFlowEntry,
  foreach: { type: 'foreach', step: single('item') } as unknown as StepFlowEntry,
};

/** No restart, a restart without flags, or a restart with one flag set. */
type Restart = 'none' | 'restart' | `${'isParallelOrConditionalRestarted' | 'isForeachRestarted'}=${boolean}`;

function restartParams(restart: Restart): RestartExecutionParams | undefined {
  if (restart === 'none') {
    return undefined;
  }

  const params: RestartExecutionParams = { activePaths: [], activeStepsPath: {}, stepResults: {} };
  if (restart === 'restart') {
    return params;
  }

  const [flag, value] = restart.split('=') as ['isParallelOrConditionalRestarted' | 'isForeachRestarted', string];
  return { ...params, [flag]: value === 'true' };
}

type Row = { entry: keyof typeof entries; path: number[]; restart: Restart; kind: string; leaf?: StepFlowEntry };

const branchRows = (entry: 'parallel' | 'conditional'): Row[] => [
  { entry, path: [0], restart: 'none', kind: 'dispatch' },
  { entry, path: [0, 1], restart: 'none', kind: 'leaf', leaf: right },
  { entry, path: [0], restart: 'isParallelOrConditionalRestarted=true', kind: 'dispatch' },
  { entry, path: [0, 1], restart: 'restart', kind: 'dispatch' },
  { entry, path: [0, 1], restart: 'isParallelOrConditionalRestarted=false', kind: 'dispatch' },
  { entry, path: [0, 1], restart: 'isParallelOrConditionalRestarted=true', kind: 'leaf', leaf: right },
  { entry, path: [0, 2], restart: 'none', kind: 'missing' },
];

const rows: Row[] = [
  { entry: 'step', path: [0], restart: 'none', kind: 'leaf', leaf: entries.step },
  { entry: 'step', path: [0], restart: 'restart', kind: 'leaf', leaf: entries.step },
  { entry: 'classifier', path: [0], restart: 'none', kind: 'leaf', leaf: entries.classifier },
  { entry: 'loop', path: [0], restart: 'none', kind: 'leaf', leaf: entries.loop },
  { entry: 'sleep', path: [0], restart: 'none', kind: 'dispatch' },
  { entry: 'sleepUntil', path: [0], restart: 'none', kind: 'dispatch' },
  ...branchRows('parallel'),
  ...branchRows('conditional'),
  { entry: 'foreach', path: [0], restart: 'none', kind: 'dispatch' },
  { entry: 'foreach', path: [0, 2], restart: 'none', kind: 'leaf', leaf: entries.foreach },
  { entry: 'foreach', path: [0], restart: 'isForeachRestarted=true', kind: 'dispatch' },
  { entry: 'foreach', path: [0, 2], restart: 'restart', kind: 'dispatch' },
  { entry: 'foreach', path: [0, 2], restart: 'isForeachRestarted=false', kind: 'dispatch' },
  { entry: 'foreach', path: [0, 2], restart: 'isForeachRestarted=true', kind: 'leaf', leaf: entries.foreach },
  { entry: 'step', path: [1], restart: 'none', kind: 'missing' },
];

describe('routeStepRun', () => {
  it.each(rows)('$entry at $path, restart $restart: $kind', ({ entry, path, restart, kind, leaf }) => {
    const graph = [entries[entry]];
    const route = routeStepRun(graph, { executionPath: path, restart: restartParams(restart) });

    expect(route.kind).toBe(kind);
    if (route.kind === 'leaf') {
      expect(route.leaf).toBe(leaf);
    }
    if (route.kind === 'dispatch') {
      expect(route.container).toBe(graph[0]);
    }
  });
});
