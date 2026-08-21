import { describe, expect, it } from 'vitest';
import type { ArmSnapshot } from '../simulate/diff';
import { diffArms } from '../simulate/diff';

function snapshot(
  nodes: { id: string; name: string }[],
  records: { id: string; node: string; text: string }[],
): ArmSnapshot {
  return { nodes, records };
}

describe('diffArms', () => {
  it('reports no difference for identical arms', () => {
    const a = snapshot(
      [
        { id: 'n1', name: 'Project Atlas' },
        { id: 'n2', name: 'Deploy Pipeline' },
      ],
      [
        { id: 'r1', node: 'n1', text: 'Atlas ships on Fridays.' },
        { id: 'r2', node: 'n2', text: 'The pipeline runs on CI.' },
      ],
    );
    const b = snapshot(
      [
        { id: 'x1', name: 'Project Atlas' },
        { id: 'x2', name: 'Deploy Pipeline' },
      ],
      [
        { id: 'y1', node: 'x1', text: 'Atlas ships on Fridays.' },
        { id: 'y2', node: 'x2', text: 'The pipeline runs on CI.' },
      ],
    );

    const diff = diffArms(a, b);

    expect(diff.onlyInA).toEqual([]);
    expect(diff.onlyInB).toEqual([]);
    expect(diff.perNode).toEqual([]);
    expect(diff.addedRecords).toBe(0);
    expect(diff.removedRecords).toBe(0);
    expect(diff.changedRecords).toBe(0);
  });

  it('places a node found in only one arm on exactly one side, keyed by canonical name', () => {
    const a = snapshot([{ id: 'n1', name: 'Project Atlas' }], []);
    const b = snapshot(
      [
        { id: 'x1', name: 'project atlas' },
        { id: 'x2', name: 'Curation Cursor' },
      ],
      [],
    );

    const diff = diffArms(a, b);

    expect(diff.onlyInA).toEqual([]);
    expect(diff.onlyInB).toEqual(['curation cursor']);
    expect(diff.matchedNodes).toEqual(['project atlas']);
  });

  it('counts duplicate record ids within an arm once', () => {
    const a = snapshot(
      [{ id: 'n1', name: 'Project Atlas' }],
      [
        { id: 'r1', node: 'n1', text: 'Atlas ships on Fridays.' },
        { id: 'r1', node: 'n1', text: 'Atlas ships on Fridays.' },
      ],
    );
    const b = snapshot(
      [{ id: 'x1', name: 'Project Atlas' }],
      [{ id: 'y1', node: 'x1', text: 'Atlas ships on Fridays.' }],
    );

    const diff = diffArms(a, b);

    expect(diff.aRecordCount).toBe(1);
    expect(diff.bRecordCount).toBe(1);
    expect(diff.addedRecords).toBe(0);
    expect(diff.removedRecords).toBe(0);
    expect(diff.changedRecords).toBe(0);
  });

  it('detects changed content when node names and record counts match', () => {
    const a = snapshot(
      [{ id: 'n1', name: 'Project Atlas' }],
      [
        { id: 'r1', node: 'n1', text: 'Atlas ships on Fridays.' },
        { id: 'r2', node: 'n1', text: 'Atlas is owned by the platform team.' },
      ],
    );
    const b = snapshot(
      [{ id: 'x1', name: 'Project Atlas' }],
      [
        { id: 'y1', node: 'x1', text: 'Atlas ships on Fridays.' },
        { id: 'y2', node: 'x1', text: 'Atlas is owned by the infrastructure team.' },
      ],
    );

    const diff = diffArms(a, b);

    expect(diff.aRecordCount).toBe(2);
    expect(diff.bRecordCount).toBe(2);
    expect(diff.changedRecords).toBe(1);
    expect(diff.addedRecords).toBe(0);
    expect(diff.removedRecords).toBe(0);
    expect(diff.perNode).toEqual([{ node: 'project atlas', added: 0, removed: 0, changed: 1 }]);
  });
});
