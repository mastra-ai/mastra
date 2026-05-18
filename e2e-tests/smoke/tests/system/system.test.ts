import { describe, expect, it } from 'vitest';
import { fetchJson } from '../utils.js';

describe('system endpoints', () => {
  it('GET /system/api-schema returns the route catalog with method/path entries', async () => {
    const { status, data } = await fetchJson<any>('/api/system/api-schema');
    expect(status).toBe(200);
    expect(data.version).toBe(1);
    expect(Array.isArray(data.routes)).toBe(true);
    // The Mastra server exposes 200+ routes — guard against a major regression.
    expect(data.routes.length).toBeGreaterThan(200);

    const methods = new Set(data.routes.map((r: any) => r.method));
    expect(methods.has('GET')).toBe(true);
    expect(methods.has('POST')).toBe(true);

    // A handful of well-known routes must be registered. Paths are stored
    // without the /api prefix (e.g. "/agents", "/memory/threads").
    const paths = new Set(data.routes.map((r: any) => r.path));
    expect(paths.has('/agents')).toBe(true);
    expect(paths.has('/workflows')).toBe(true);
    expect(paths.has('/memory/threads')).toBe(true);
    expect(paths.has('/schedules')).toBe(true);
  });

  it('GET /system/packages reports fixture-level configuration', async () => {
    const { status, data } = await fetchJson<any>('/api/system/packages');
    expect(status).toBe(200);
    expect(Array.isArray(data.packages)).toBe(true);
    expect(typeof data.isDev).toBe('boolean');
    expect(typeof data.cmsEnabled).toBe('boolean');
    // The smoke fixture wires up composite storage with DuckDB observability.
    expect(data.observabilityEnabled).toBe(true);
    expect(data.storageType).toBe('MastraCompositeStore');
    expect(data.observabilityStorageType).toBe('ObservabilityStorageDuckDB');
    expect(typeof data.observabilityRuntimeStrategy).toBe('string');
  });
});
