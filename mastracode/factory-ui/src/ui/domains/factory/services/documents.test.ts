import { describe, expect, it } from 'vitest';

import type { FactoryDocumentsResponse } from '../../../../api/types';
import { countPresent, inventoryByGroup, inventoryRows } from './documents';

const response: FactoryDocumentsResponse = {
  docsRoot: 'docs/factory',
  manifestPath: 'docs/factory/manifest.yaml',
  catalog: [
    { kind: 'glossary', group: 'ba', label: 'Glossary', defaultPath: 'docs/factory/glossary.md', purpose: 'Terms.' },
    {
      kind: 'architecture',
      group: 'tech',
      label: 'Architecture overview',
      defaultPath: 'docs/factory/architecture.md',
      purpose: 'Boxes.',
    },
    { kind: 'adrs', group: 'tech', label: 'ADRs', defaultPath: 'docs/factory/adrs.md', purpose: 'Decisions.' },
  ],
  documents: [
    {
      id: 'd1',
      kind: 'architecture',
      path: 'docs/factory/arch/system.md',
      title: 'System',
      summary: null,
      status: 'present',
      contentHash: 'h',
      sizeBytes: 10,
      sourceRef: 'origin/main',
      sourceSha: 'abc',
      syncedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  sync: { sourceRef: 'origin/main', sourceSha: 'abc', manifestStatus: 'ok', syncedAt: '2026-09-01T00:00:00.000Z' },
};

describe('inventoryRows', () => {
  it('keeps catalog order, joins synced entries, and synthesises missing rows', () => {
    const rows = inventoryRows(response);
    expect(rows.map(row => row.kind)).toEqual(['glossary', 'architecture', 'adrs']);
    expect(rows[1]).toMatchObject({ status: 'present', path: 'docs/factory/arch/system.md' });
    expect(rows[1]?.document?.title).toBe('System');
    expect(rows[0]).toMatchObject({ status: 'missing', path: 'docs/factory/glossary.md', document: null });
  });

  it('groups by business and technical and counts present documents', () => {
    const groups = inventoryByGroup(response);
    expect(groups.ba.map(row => row.kind)).toEqual(['glossary']);
    expect(groups.tech.map(row => row.kind)).toEqual(['architecture', 'adrs']);
    expect(countPresent(inventoryRows(response))).toEqual({ present: 1, total: 3 });
  });
});
