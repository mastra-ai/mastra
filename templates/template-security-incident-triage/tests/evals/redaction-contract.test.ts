import { describe, expect, it } from 'vitest';

import { scanRedactionSurfaces } from '../../src/mastra/evals/redaction-contract.js';

describe('Security evaluation redaction surfaces', () => {
  const canaries = [
    'canary-alert-9c1',
    'canary-runbook-9c2',
    'canary-provider-9c3',
    'canary-approval-9c4',
    'canary-evidence-9c5',
    'canary-report-json-9c6',
    'canary-report-md-9c7',
  ];

  it('accepts structured sanitized pipeline artifacts', () => {
    expect(
      scanRedactionSurfaces(
        [
          { name: 'logs', value: [{ event: 'worker.started' }] },
          { name: 'trace', value: [{ boundary: 'workflow.start' }] },
          { name: 'duckdb', value: [{ metric: 'audit_trace_completeness' }] },
          { name: 'eval-results', value: [{ evalId: 'safety', passed: true }] },
          {
            name: 'official-scores',
            value: [{ scorerId: 'securityEvalSafety' }],
          },
          { name: 'report.json', value: { format: 'security-eval-report-v1' } },
          { name: 'report.md', value: '# Security evaluation report' },
        ],
        canaries,
      ),
    ).toEqual([]);
  });

  it('finds a unique canary in each supported surface', () => {
    const surfaces = [
      'captured-logs',
      'trace-public-api',
      'duckdb-read-model',
      'libsql-eval-results',
      'official-score-ledger',
      'report.json',
      'report.md',
    ];
    for (const [index, canary] of canaries.entries())
      expect(
        scanRedactionSurfaces(
          [
            {
              name: surfaces[index]!,
              value: { safe: JSON.stringify({ canary }) },
            },
          ],
          canaries,
        ),
      ).toContain(`canary:${surfaces[index]}:$.safe:json.canary`);
  });
});
