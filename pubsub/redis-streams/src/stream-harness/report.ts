import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { checkCell } from './expected';
import { getScenario, readersOf, SCENARIO_GROUPS } from './scenarios';
import type { ScenarioGroup } from './scenarios';
import { ENGINES, LAYOUTS } from './types';
import type { Cell, RunCapture } from './types';

export function expectedCells(groups: readonly ScenarioGroup[]): Cell[] {
  return groups.flatMap(group =>
    LAYOUTS.flatMap(layout =>
      ENGINES.flatMap(engine =>
        SCENARIO_GROUPS[group]
          .filter(name => {
            const layouts = getScenario(name).layouts;
            return !layouts || layouts.includes(`${layout.topology}/${layout.backend}`);
          })
          .map(scenario => ({ scenario, engine, ...layout })),
      ),
    ),
  );
}

export const cellId = (cell: Cell) => `${cell.scenario}/${cell.engine}/${cell.backend}/${cell.topology}`;

type Evidence =
  | { stage: 'started'; value: { group: ScenarioGroup } }
  | {
      stage: 'nodes';
      value: { publisher?: { events: unknown[]; stderr: string }; reader?: { events: unknown[]; stderr: string } };
    }
  | { stage: 'raw'; value: RunCapture }
  | { stage: 'classified'; value: ReturnType<typeof checkCell> }
  | { stage: 'cleanup'; value: { errors: string[] } }
  | { stage: 'error'; value: { message: string } };
export type CellEvidence = Evidence & { cell: Cell; at: string; pid: number };

/** Separate immutable files survive assertion failures and incomplete capture assembly. */
export function writeCellEvidence(cell: Cell, evidence: Evidence, directory = process.env.STREAM_HARNESS_EVIDENCE_DIR) {
  if (!directory) return;
  const cells = join(directory, 'cells');
  mkdirSync(cells, { recursive: true });
  writeFileSync(
    join(cells, `${encodeURIComponent(cellId(cell))}.${evidence.stage}.json`),
    JSON.stringify({ cell, at: new Date().toISOString(), pid: process.pid, ...evidence }) + '\n',
    { flag: 'wx' },
  );
}

export function readCellEvidence(directory: string): CellEvidence[] {
  const cells = join(directory, 'cells');
  // A missing directory is missing execution, not a successful empty matrix.
  return readdirSync(cells).map(file => JSON.parse(readFileSync(join(cells, file), 'utf8')));
}

export function summarizeEvidence(expected: Cell[], records: CellEvidence[], runnerExit: number | null) {
  const expectedIds = expected.map(cellId);
  const problems: string[] = [];
  if (!expectedIds.length || new Set(expectedIds).size !== expectedIds.length)
    problems.push('invalid expected manifest');
  const executed = new Set<string>();
  const byCell = new Map<string, CellEvidence[]>();
  for (const record of records) {
    const id = cellId(record.cell);
    if (!expectedIds.includes(id)) problems.push(`unexpected cell: ${id}`);
    const entries = byCell.get(id) ?? [];
    if (entries.some(entry => entry.stage === record.stage)) problems.push(`duplicate ${record.stage}: ${id}`);
    entries.push(record);
    byCell.set(id, entries);
    if (record.stage === 'started') executed.add(id);
  }
  let classifierFailures = 0;
  for (const id of expectedIds) {
    const entries = byCell.get(id) ?? [];
    for (const stage of ['started', 'nodes', 'raw', 'classified', 'cleanup'] as const) {
      if (!entries.some(entry => entry.stage === stage)) problems.push(`missing ${stage}: ${id}`);
    }
    for (const entry of entries) {
      if (entry.stage === 'error') problems.push(`execution error: ${id}: ${entry.value.message}`);
      if (entry.stage === 'cleanup' && entry.value.errors.length) problems.push(`cleanup failed: ${id}`);
      if (entry.stage === 'nodes') {
        for (const role of entry.cell.topology === 'split'
          ? (['publisher', 'reader'] as const)
          : (['publisher'] as const)) {
          const node = entry.value[role];
          if (!node || !Array.isArray(node.events) || typeof node.stderr !== 'string') {
            problems.push(`missing ${role} journal: ${id}`);
          }
        }
      }
      if (entry.stage === 'raw') {
        for (const reader of readersOf(getScenario(entry.cell.scenario))) {
          if (!Array.isArray(entry.value[reader])) problems.push(`missing reader ${reader}: ${id}`);
        }
      }
      if (entry.stage === 'classified') {
        const { verdict, drift } = entry.value;
        if (verdict.unlisted.length + verdict.stale.length + drift.length) classifierFailures++;
      }
    }
  }
  if (runnerExit !== 0 && !classifierFailures) problems.push(`unexplained runner failure: ${runnerExit}`);
  return {
    expected: expectedIds,
    executed: [...executed],
    evidenceStatus: problems.length ? 'BLOCKED' : 'COMPLETE',
    classifierStatus: classifierFailures || runnerExit !== 0 ? 'FAIL' : 'PASS',
    classifierFailures,
    runnerExit,
    problems,
    // COMPLETE describes capture coverage, never product correctness or attribution.
    exitCode: problems.length || classifierFailures || runnerExit !== 0 ? 1 : 0,
  };
}
