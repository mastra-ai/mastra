import { describe, expect, it } from 'vitest';
import type { ArmSnapshot } from './diff';
import { diffArms } from './diff';

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
    expect(diff.perNode).toEqual([
      {
        node: 'project atlas',
        presence: 'both',
        added: [],
        removed: [],
        changed: [{ a: 'atlas is owned by the platform team.', b: 'atlas is owned by the infrastructure team.' }],
      },
    ]);
  });

  it('counts records under one-arm-unique nodes in the added/removed totals', () => {
    const a = snapshot(
      [
        { id: 'n1', name: 'Project Atlas' },
        { id: 'n2', name: 'Legacy System' },
      ],
      [
        { id: 'r1', node: 'n1', text: 'Atlas ships on Fridays.' },
        { id: 'r2', node: 'n2', text: 'The legacy system is deprecated.' },
        { id: 'r3', node: 'n2', text: 'The legacy system runs on-prem.' },
      ],
    );
    const b = snapshot(
      [
        { id: 'x1', name: 'Project Atlas' },
        { id: 'x2', name: 'New Service' },
      ],
      [
        { id: 'y1', node: 'x1', text: 'Atlas ships on Fridays.' },
        { id: 'y2', node: 'x2', text: 'The new service launched in May.' },
      ],
    );

    const diff = diffArms(a, b);

    expect(diff.onlyInA).toEqual(['legacy system']);
    expect(diff.onlyInB).toEqual(['new service']);
    // Records under nodes unique to one arm must not disappear from the totals.
    expect(diff.removedRecords).toBe(2);
    expect(diff.addedRecords).toBe(1);
    expect(diff.changedRecords).toBe(0);
    expect(diff.perNode).toEqual([
      {
        node: 'legacy system',
        presence: 'only-a',
        added: [],
        removed: ['the legacy system is deprecated.', 'the legacy system runs on-prem.'],
        changed: [],
      },
      {
        node: 'new service',
        presence: 'only-b',
        added: ['the new service launched in may.'],
        removed: [],
        changed: [],
      },
    ]);
  });

  it('carries normalized record text in per-node added and removed lists', () => {
    const a = snapshot(
      [{ id: 'n1', name: 'Project Atlas' }],
      [{ id: 'r1', node: 'n1', text: '  Atlas   ships\n on Fridays. ' }],
    );
    const b = snapshot(
      [{ id: 'x1', name: 'Project Atlas' }],
      [
        { id: 'y1', node: 'x1', text: 'Atlas ships on Fridays.' },
        { id: 'y2', node: 'x1', text: 'Atlas has a staging environment.' },
      ],
    );

    const diff = diffArms(a, b);

    expect(diff.addedRecords).toBe(1);
    expect(diff.removedRecords).toBe(0);
    expect(diff.perNode).toEqual([
      {
        node: 'project atlas',
        presence: 'both',
        added: ['atlas has a staging environment.'],
        removed: [],
        changed: [],
      },
    ]);
  });
});
