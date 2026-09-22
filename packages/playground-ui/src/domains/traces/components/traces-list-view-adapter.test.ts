import { describe, expect, it } from 'vitest';
import { firstTraceQueryPage } from '../hooks/__tests__/fixtures/trace-query';
import { toTracesListViewTraces } from './traces-list-view-adapter';

describe('toTracesListViewTraces', () => {
  it('maps root identity and preserves list display fields', () => {
    const trace = firstTraceQueryPage.traces[0];
    if (!trace) throw new Error('Expected a trace fixture');
    expect(toTracesListViewTraces([trace])).toEqual([
      {
        traceId: trace.traceId,
        spanId: trace.rootSpanId,
        parentSpanId: trace.parentSpanId,
        name: trace.name,
        createdAt: trace.createdAt,
        inputPreview: trace.inputPreview,
        metadata: trace.metadata,
        entityId: trace.entityId,
        entityName: trace.entityName,
        entityType: trace.entityType,
        status: trace.status,
        startedAt: trace.startedAt,
        endedAt: trace.endedAt,
      },
    ]);
  });

  describe('when the span name carries a run prefix', () => {
    const base = firstTraceQueryPage.traces[0];
    if (!base) throw new Error('Expected a trace fixture');
    const nameOf = (name: string | null) => toTracesListViewTraces([{ ...base, name }])[0]?.name;

    it('strips the agent run prefix', () => {
      expect(nameOf("agent run: 'weatherAgent'")).toBe('weatherAgent');
    });

    it('strips the workflow run prefix', () => {
      expect(nameOf("workflow run: 'orderFlow'")).toBe('orderFlow');
    });

    it('strips the scorer run prefix', () => {
      expect(nameOf("scorer run: 'toxicity'")).toBe('toxicity');
    });

    it('keeps the resumed suffix after stripping', () => {
      expect(nameOf("agent run: 'weatherAgent' (resumed)")).toBe('weatherAgent (resumed)');
    });

    it('leaves names without a prefix untouched', () => {
      expect(nameOf('fetchWeather')).toBe('fetchWeather');
    });

    it('keeps a null name null', () => {
      expect(nameOf(null)).toBeNull();
    });
  });
});
