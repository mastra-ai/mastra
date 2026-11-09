import { expect, it } from 'vitest';
import { SpanType } from '@mastra/core/observability';
import { createLocalObservability, telemetryId } from '../../src/mastra/observability/privacy.ts';

it('keeps sanitized entity IDs stable across repeated span processing and new identities', async () => {
  const observability = createLocalObservability();
  try {
    const instance = observability.getDefaultInstance()!;
    const processor = instance.getSpanOutputProcessors().find(p => p.name === 'vrq-metadata-only')!;
    const span = instance.startSpan({ type: SpanType.GENERIC, name: 'identity-test', entityId: 'original-entity' });
    processor.process(span);
    const first = telemetryId('original-entity');
    expect(span.entityId).toBe(first);
    processor.process(span);
    processor.process(span);
    expect(span.entityId).toBe(first);
    span.entityId = 'replacement-entity';
    processor.process(span);
    expect(span.entityId).toBe(telemetryId('replacement-entity'));
    processor.process(span);
    expect(span.entityId).toBe(telemetryId('replacement-entity'));
    span.entityId = undefined;
    processor.process(span);
    expect(span.entityId).toBeUndefined();
    span.end();
  } finally {
    await observability.shutdown();
  }
});
