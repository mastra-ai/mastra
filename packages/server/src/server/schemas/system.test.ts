import { describe, expect, it } from 'vitest';
import { NO_OBSERVABILITY_STORAGE_CAPABILITIES } from '../handlers/observability-shared';
import { observabilityStorageCapabilitiesSchema } from './system';

describe('observabilityStorageCapabilitiesSchema', () => {
  it('treats an omitted span context capability from an older server as unavailable', () => {
    const { spanQueryContextFields: _, ...legacyCapabilities } = NO_OBSERVABILITY_STORAGE_CAPABILITIES;
    expect(observabilityStorageCapabilitiesSchema.parse(legacyCapabilities)).toMatchObject({
      spanQueryContextFields: false,
    });
  });

  it('treats omitted span filter capabilities from an older server as unavailable', () => {
    const legacyCapabilities = { ...NO_OBSERVABILITY_STORAGE_CAPABILITIES };
    for (const key of ['spanQueryParentEntityFields', 'spanQueryRootEntityFields', 'spanQueryExecutionSource']) {
      delete (legacyCapabilities as Record<string, unknown>)[key];
    }
    expect(observabilityStorageCapabilitiesSchema.parse(legacyCapabilities)).toMatchObject({
      spanQueryParentEntityFields: false,
      spanQueryRootEntityFields: false,
      spanQueryExecutionSource: false,
    });
  });

  it('keeps the trace retention a store reports', () => {
    const parsed = observabilityStorageCapabilitiesSchema.parse({
      ...NO_OBSERVABILITY_STORAGE_CAPABILITIES,
      traceRetentionDays: 180,
    });

    expect(parsed.traceRetentionDays).toBe(180);
  });

  it('leaves trace retention out when a store does not report one', () => {
    const parsed = observabilityStorageCapabilitiesSchema.parse(NO_OBSERVABILITY_STORAGE_CAPABILITIES);

    expect(parsed).not.toHaveProperty('traceRetentionDays');
  });

  it.each([0, -1, 1.5])('rejects a trace retention of %s days', traceRetentionDays => {
    expect(
      observabilityStorageCapabilitiesSchema.safeParse({
        ...NO_OBSERVABILITY_STORAGE_CAPABILITIES,
        traceRetentionDays,
      }).success,
    ).toBe(false);
  });
});
