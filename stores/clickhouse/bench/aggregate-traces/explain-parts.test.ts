import { describe, expect, it } from 'vitest';

import { summarizeExplain } from './explain-parts';

describe('summarizeExplain', () => {
  it('keeps tables, index steps and part/granule counts, and drops conditions and keys', () => {
    const lines = [
      'Expression ((Project names + Projection))',
      '  ReadFromMergeTree (platform.mastra_span_events)',
      '  Indexes:',
      '    PrimaryKey',
      '      Keys:',
      '        organizationId',
      "      Condition: and((organizationId in ['secret-org']), (traceId in 25-element set))",
      '      Parts: 12/455',
      '      Granules: 40/90000',
      '    Partition',
      '      Condition: (toDate(endedAt) in [20261001, +Inf))',
      '      Parts: 30/455',
      '      Granules: 3000/90000',
    ];
    const out = summarizeExplain(lines).join('\n');
    expect(out).toBe(
      [
        'mastra_span_events',
        '  PrimaryKey',
        '    Parts: 12/455',
        '    Granules: 40/90000',
        '  Partition',
        '    Parts: 30/455',
        '    Granules: 3000/90000',
      ].join('\n'),
    );
    expect(out).not.toContain('secret-org');
    expect(out).not.toContain('Condition');
  });
});
