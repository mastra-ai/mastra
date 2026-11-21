import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { checkCell } from './expected';
import { cellId, expectedCells, readCellEvidence, summarizeEvidence, writeCellEvidence } from './report';
import type { CellEvidence } from './report';
import type { Cell, Frame, RunCapture } from './types';

const cell: Cell = { scenario: 'transport-control', engine: 'plain', backend: 'redis', topology: 'single' };
// Normalised reader output from the real Phase 4 transport-control/plain/redis/single run.
const frames: Frame[] = [
  { type: 'start' },
  { type: 'step-start' },
  { type: 'text-start' },
  {
    type: 'text-delta',
    shape: 'This answer streams slowly on purpose, so that something can happen to the run before it ends.',
  },
  { type: 'text-end' },
  { type: 'step-finish' },
  { type: 'finish' },
];
const capture: RunCapture = Object.fromEntries(
  ['live', 'observe-mid', 'topic', 'observe-0', 'http-observe', 'thread'].map(reader => [reader, frames]),
);
const metadata = { cell, at: '2026-11-15T00:00:00.000Z', pid: 1 };
const complete = (): CellEvidence[] => [
  { ...metadata, stage: 'started', value: { group: 'faults' } },
  { ...metadata, stage: 'nodes', value: { publisher: { events: [{ type: 'ready' }], stderr: '' } } },
  { ...metadata, stage: 'raw', value: structuredClone(capture) },
  { ...metadata, stage: 'classified', value: checkCell(cell, capture, undefined) },
  { ...metadata, stage: 'cleanup', value: { errors: [] } },
];

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('stream harness evidence integrity', () => {
  it('requires the full engine/backend/topology manifest, including fault cells', () => {
    const cells = expectedCells(['chunks', 'lifecycle', 'faults']);
    expect(cells).toHaveLength(276);
    expect(new Set(cells.map(cellId)).size).toBe(276);
    expect(expectedCells(['faults'])).toHaveLength(66);
    expect(cells).toContainEqual(cell);
    expect(cells).not.toContainEqual({ ...cell, backend: 'memory' });
  });

  it('reports complete real reader output without claiming a product fix', () => {
    expect(summarizeEvidence([cell], complete(), 0)).toMatchObject({
      evidenceStatus: 'COMPLETE',
      classifierStatus: 'PASS',
      exitCode: 0,
      problems: [],
    });
  });

  it.each(['started', 'nodes', 'raw', 'classified', 'cleanup'] as const)(
    'fails when the %s capture stage is absent',
    stage => {
      const summary = summarizeEvidence(
        [cell],
        complete().filter(record => record.stage !== stage),
        0,
      );
      expect(summary.exitCode).toBe(1);
      expect(summary.problems).toContain(`missing ${stage}: ${cellId(cell)}`);
    },
  );

  it('keeps timeout partial node output but rejects qualification without a complete capture', () => {
    const partial: CellEvidence[] = [
      ...complete().filter(record => record.stage !== 'raw' && record.stage !== 'classified'),
      { ...metadata, stage: 'error', value: { message: 'Timed out assembling observe-0' } },
    ];
    const summary = summarizeEvidence([cell], partial, 1);
    expect(summary.evidenceStatus).toBe('BLOCKED');
    expect(summary.exitCode).toBe(1);
    expect(summary.problems).toContain(`execution error: ${cellId(cell)}: Timed out assembling observe-0`);
    expect(partial.find(record => record.stage === 'nodes')?.value.publisher?.events).toHaveLength(1);
  });

  it('does not turn a classifier failure into an infrastructure failure or a successful exit', () => {
    const records = complete();
    const classified = records.find(record => record.stage === 'classified')!;
    classified.value.drift.push({
      reader: 'live',
      kind: 'stale-symptom',
      detail: 'COR-1561: no pinned fault symptom reproduced',
    });
    expect(summarizeEvidence([cell], records, 1)).toMatchObject({
      evidenceStatus: 'COMPLETE',
      classifierStatus: 'FAIL',
      classifierFailures: 1,
      exitCode: 1,
    });
  });

  it('fails missing reader output even when the runner returned zero', () => {
    const records = complete();
    const raw = records.find(record => record.stage === 'raw')!;
    delete raw.value['observe-0'];
    expect(summarizeEvidence([cell], records, 0).problems).toContain(`missing reader observe-0: ${cellId(cell)}`);
  });

  it('rejects cleanup errors, duplicate stages, unexpected cells and empty manifests', () => {
    const records = complete();
    const cleanup = records.find(record => record.stage === 'cleanup')!;
    cleanup.value.errors.push('proxy deletion failed');
    records.push(records[0]!, {
      ...metadata,
      cell: { ...cell, engine: 'durable' },
      stage: 'started',
      value: { group: 'faults' },
    });
    expect(summarizeEvidence([cell], records, 0).problems).toEqual(
      expect.arrayContaining([
        `cleanup failed: ${cellId(cell)}`,
        `duplicate started: ${cellId(cell)}`,
        'unexpected cell: transport-control/durable/redis/single',
      ]),
    );
    expect(summarizeEvidence([], [], 0).exitCode).toBe(1);
    expect(summarizeEvidence([cell, cell], complete(), 0).exitCode).toBe(1);
    expect(summarizeEvidence([cell], complete(), null).exitCode).toBe(1);
  });

  it('rejects missing process journals and unexplained runner failures', () => {
    const records = complete();
    const nodes = records.find(record => record.stage === 'nodes')!;
    delete nodes.value.publisher;
    expect(summarizeEvidence([cell], records, 0).problems).toContain(`missing publisher journal: ${cellId(cell)}`);
    const split = { ...cell, topology: 'split' as const };
    const splitRecords = complete().map(record => ({ ...record, cell: split }));
    expect(summarizeEvidence([split], splitRecords, 0).problems).toContain(`missing reader journal: ${cellId(split)}`);
    expect(summarizeEvidence([cell], complete(), 1)).toMatchObject({ evidenceStatus: 'BLOCKED', exitCode: 1 });
  });

  it('persists partial evidence before failure and refuses to overwrite it', () => {
    const directory = mkdtempSync(join(tmpdir(), 'stream-report-test-'));
    directories.push(directory);
    expect(() => readCellEvidence(directory)).toThrow();
    writeCellEvidence(cell, { stage: 'started', value: { group: 'faults' } }, directory);
    expect(() => writeCellEvidence(cell, { stage: 'started', value: { group: 'faults' } }, directory)).toThrow();
    const records = readCellEvidence(directory);
    expect(records).toHaveLength(1);
    expect(summarizeEvidence([cell], records, 1).evidenceStatus).toBe('BLOCKED');
  });
});
