import { describe, expect, it } from 'vitest';
import { EntityType, SpanType } from '../observability';
import type { SpanRecord } from '../storage/domains/observability/tracing';
import { PROCESSOR_ENTITY_TYPE_TO_PHASE, getProcessorSpanPhase, isProcessorSpan } from './span-io';

function makeSpan(entityType: EntityType | null): SpanRecord {
  return {
    traceId: 't',
    spanId: 's',
    name: 'processor',
    spanType: SpanType.PROCESSOR_RUN,
    isEvent: false,
    startedAt: new Date(),
    entityType,
    input: null,
    output: null,
  } as SpanRecord;
}

describe('span-io', () => {
  describe('getProcessorSpanPhase', () => {
    it.each([
      [EntityType.INPUT_PROCESSOR, 'input'],
      [EntityType.INPUT_STEP_PROCESSOR, 'inputStep'],
      [EntityType.OUTPUT_PROCESSOR, 'output'],
      [EntityType.OUTPUT_STEP_PROCESSOR, 'outputStep'],
      [EntityType.TOOL_RESULT_PROCESSOR, 'toolResult'],
    ] as const)('maps %s to %s', (entityType, phase) => {
      expect(getProcessorSpanPhase(makeSpan(entityType))).toBe(phase);
      expect(PROCESSOR_ENTITY_TYPE_TO_PHASE[entityType]).toBe(phase);
    });

    it('returns undefined for non-processor entity types', () => {
      expect(getProcessorSpanPhase(makeSpan(EntityType.AGENT))).toBeUndefined();
      expect(getProcessorSpanPhase(makeSpan(null))).toBeUndefined();
    });
  });

  describe('isProcessorSpan', () => {
    it('matches only the requested phase', () => {
      const span = makeSpan(EntityType.INPUT_STEP_PROCESSOR);
      expect(isProcessorSpan(span, 'inputStep')).toBe(true);
      expect(isProcessorSpan(span, 'input')).toBe(false);
    });
  });
});
