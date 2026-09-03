import { describe, expect, it } from 'vitest';
import { createTargetSpanId, createTargetTraceId } from './ids.js';

describe('trace import IDs', () => {
  it('creates deterministic OTel-compatible IDs with project isolation', () => {
    const traceId = createTargetTraceId('project-a', 'trace-1');
    const spanId = createTargetSpanId('project-a', 'span-1');
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(createTargetTraceId('project-a', 'trace-1')).toBe(traceId);
    expect(createTargetTraceId('project-b', 'trace-1')).not.toBe(traceId);
    expect(createTargetSpanId('project-b', 'span-1')).not.toBe(spanId);
  });

  it('matches the Platform import contract fixture', () => {
    expect(createTargetTraceId('lf-project-1', 'lf-trace-1')).toBe('cdac6830cdd9b85dd40fb52cb12283c5');
    expect(createTargetSpanId('lf-project-1', 'lf-observation-1')).toBe('10640c8057952ae1');
  });
});
