import { describe, expect, it } from 'vitest';

import {
  traceContextManifest,
  validateTraceManifest,
  type SanitizedTraceBoundary,
} from '../../src/mastra/evals/trace-contract.js';

const opaque = 'opaque:v1:0123456789abcdef';

function trace(disposition: 'approved' | 'rejected' | 'expired' = 'approved'): SanitizedTraceBoundary[] {
  const manifest = traceContextManifest('privilege', disposition);
  // Parent entries are emitted in causal order by the versioned manifest.
  // Keeping this fixture derived from them prevents a stale, minimal graph
  // from silently drifting below the product contract.
  const names = Object.keys(manifest.parents);
  const indexes = new Map(names.map((name, index) => [name, index]));
  const workflowContextIndex = indexes.get('workflow.context')!;
  const gatherOffset = new Map([
    ['gather.identity', 10],
    ['gather.endpoint', 20],
    ['gather.cloud', 30],
  ]);
  return names.map((name, index) => {
    const gatherStart = gatherOffset.get(name);
    const startMs = gatherStart === undefined ? index * 100 : workflowContextIndex * 100 + gatherStart;
    return {
      spanId: `span-${index}`,
      traceId: 'trace-1',
      ...(manifest.parents[name] ? { parentSpanId: `span-${indexes.get(manifest.parents[name])!}` } : {}),
      name,
      startMs,
      endMs: gatherStart === undefined ? startMs + 50 : workflowContextIndex * 100 + 90,
      attributes: {
        tenantId: opaque,
        incidentId: opaque,
        runId: opaque,
        requestId: opaque,
        correlationId: opaque,
        boundary: name,
        ...Object.fromEntries((manifest.requiredIdentifiers[name] ?? []).map(key => [key, opaque])),
      },
    };
  });
}

describe('Security evaluation trace contract', () => {
  it('requires official boundary order and rejects canaries on all surfaces', () => {
    expect(
      validateTraceManifest(
        trace('approved'),
        traceContextManifest('privilege', 'approved'),
        ['sanitized report', 'sanitized trace', 'sanitized duckdb'],
        ['security-eval-secret-canary'],
      ),
    ).toEqual([]);
    expect(
      validateTraceManifest(
        trace('expired'),
        traceContextManifest('device', 'expired'),
        ['security-eval-secret-canary'],
        ['security-eval-secret-canary'],
      ),
    ).toEqual(expect.arrayContaining(['canary:security-eval-secret-canary']));
  });

  it('rejects missing boundaries and a wrong parent in a complete fixture', () => {
    const nominal = trace('approved');
    expect(
      validateTraceManifest(
        nominal.filter(span => span.name !== 'gather.identity'),
        traceContextManifest('privilege', 'approved'),
        ['sanitized'],
        [],
      ),
    ).toContain('missing:gather.identity');
    expect(
      validateTraceManifest(
        nominal.map(span => (span.name === 'gather.identity' ? { ...span, parentSpanId: 'span-0' } : span)),
        traceContextManifest('privilege', 'approved'),
        ['sanitized'],
        [],
      ),
    ).toContain('parent:gather.identity:workflow.context');
  });

  it('rejects gathers that are siblings but execute serially', () => {
    const nominal = trace('approved');
    expect(
      validateTraceManifest(
        nominal.map(span => (span.name === 'gather.endpoint' ? { ...span, startMs: 700, endMs: 750 } : span)),
        traceContextManifest('privilege', 'approved'),
        ['sanitized'],
        [],
      ),
    ).toContain('parallel:overlap:workflow.context');
  });
});
