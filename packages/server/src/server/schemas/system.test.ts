import { describe, expect, it } from 'vitest';
import { NO_OBSERVABILITY_STORAGE_CAPABILITIES } from '../handlers/observability-shared';
import { observabilityStorageCapabilitiesSchema } from './system';

describe('observabilityStorageCapabilitiesSchema', () => {
  it('treats omitted search capabilities from older servers as unavailable', () => {
    const {
      traceQueryAggregatedRoots: _roots,
      spanQueryTextSearch: _span,
      traceQueryTextSearch: _trace,
      ...legacyCapabilities
    } = NO_OBSERVABILITY_STORAGE_CAPABILITIES;
    expect(observabilityStorageCapabilitiesSchema.parse(legacyCapabilities)).toMatchObject({
      traceQueryAggregatedRoots: false,
      spanQueryTextSearch: false,
      traceQueryTextSearch: false,
    });
  });

  it('treats an omitted span context capability from an older server as unavailable', () => {
    const { spanQueryContextFields: _, ...legacyCapabilities } = NO_OBSERVABILITY_STORAGE_CAPABILITIES;
    expect(observabilityStorageCapabilitiesSchema.parse(legacyCapabilities)).toMatchObject({
      spanQueryContextFields: false,
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

it('treats missing duration ordering support from an older server as unavailable', () => {
  const { spanQueryDurationSort: _, ...legacy } = NO_OBSERVABILITY_STORAGE_CAPABILITIES;
  expect(observabilityStorageCapabilitiesSchema.parse(legacy).spanQueryDurationSort).toBe(false);
});
