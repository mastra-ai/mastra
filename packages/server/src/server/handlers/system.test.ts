import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ObservabilityStorageFeature } from '@mastra/core/storage';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET_SYSTEM_PACKAGES_ROUTE } from './system';

const NO_OBSERVABILITY_CAPABILITIES = {
  metrics: false,
  logs: false,
  discovery: {
    entityTypes: false,
    entityNames: false,
    serviceNames: false,
    environments: false,
    tags: false,
    metrics: false,
  },
  deltaPolling: false,
  traceQuery: false,
  traceQueryRootDuration: false,
  traceQueryDiscovery: false,
  traceQueryTenantScope: false,
  threadQuery: false,
};

type MockStorage = {
  name?: string;
  stores?: {
    observability?: {
      constructor?: { name?: string };
      runtimeTracingStrategy?: 'realtime' | 'batch-with-updates' | 'insert-only' | 'event-sourced';
      getFeatures?: () => readonly ObservabilityStorageFeature[] | undefined;
    };
  };
};

type MockEditor = {
  getSource?: () => 'code' | 'db' | undefined;
  getSourceControlProvider?: () =>
    | {
        id: string;
        displayName: string;
        getCapabilities: () => Promise<{
          canWrite: boolean;
          canOpenChangeRequest: boolean;
          reason?: string;
        }>;
      }
    | undefined;
};

type MockServer = {
  apiRoutes?: Array<{
    method: 'GET' | 'POST';
    path: string;
  }>;
};

const createMockMastra = (
  editor: boolean | MockEditor,
  storage?: MockStorage,
  hasObservability = false,
  server?: MockServer,
) =>
  ({
    getEditor: () => (editor === true ? {} : editor || undefined),
    getStorage: () => storage,
    getServer: () => server,
    observability: {
      getDefaultInstance: () => (hasObservability ? {} : undefined),
    },
  }) as any;

describe('System Handlers', () => {
  const originalEnv = process.env;
  let tempDir: string;
  let tempFilePath: string;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    tempDir = mkdtempSync(join(tmpdir(), 'mastra-test-'));
    tempFilePath = join(tempDir, 'packages.json');
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
    try {
      unlinkSync(tempFilePath);
    } catch {
      // File may not exist
    }
  });

  describe('GET_SYSTEM_PACKAGES_ROUTE', () => {
    it('should return packages when MASTRA_PACKAGES_FILE is set', async () => {
      const packages = [
        { name: '@mastra/core', version: '1.0.0' },
        { name: 'mastra', version: '1.0.0' },
      ];
      writeFileSync(tempFilePath, JSON.stringify(packages), 'utf-8');
      process.env.MASTRA_PACKAGES_FILE = tempFilePath;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({
        packages,
        isDev: false,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE is not set', async () => {
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({
        packages: [],
        isDev: false,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE points to invalid JSON', async () => {
      writeFileSync(tempFilePath, 'not-valid-json', 'utf-8');
      process.env.MASTRA_PACKAGES_FILE = tempFilePath;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({
        packages: [],
        isDev: false,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return empty array when MASTRA_PACKAGES_FILE points to non-existent file', async () => {
      process.env.MASTRA_PACKAGES_FILE = '/non/existent/path/packages.json';

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({
        packages: [],
        isDev: false,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return isDev true when MASTRA_DEV is set', async () => {
      process.env.MASTRA_DEV = 'true';
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({
        packages: [],
        isDev: true,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return cmsEnabled true when editor is configured', async () => {
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(true) } as any);

      expect(result).toEqual({
        packages: [],
        isDev: false,
        cmsEnabled: true,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return cmsEnabled false when editor is not configured', async () => {
      delete process.env.MASTRA_PACKAGES_FILE;

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({ mastra: createMockMastra(false) } as any);

      expect(result).toEqual({
        packages: [],
        isDev: false,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return liveKitConnectionRouteEnabled true for the exact default LiveKit POST route', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra(false, undefined, false, {
          apiRoutes: [{ method: 'POST', path: '/voice/livekit/connection-details' }],
        }),
      } as any);

      expect(result).toMatchObject({ liveKitConnectionRouteEnabled: true });
    });

    it.each([
      {
        name: 'a different method',
        route: { method: 'GET' as const, path: '/voice/livekit/connection-details' },
      },
      {
        name: 'a custom path',
        route: { method: 'POST' as const, path: '/voice/livekit/custom-connection-details' },
      },
    ])('should return liveKitConnectionRouteEnabled false for $name', async ({ route }) => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra(false, undefined, false, { apiRoutes: [route] }),
      } as any);

      expect(result).toMatchObject({ liveKitConnectionRouteEnabled: false });
    });

    it('should return filesystem capabilities for local code-source editor storage', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra({ getSource: () => 'code' }),
      } as any);

      expect(result).toMatchObject({
        cmsEnabled: true,
        editorSource: 'code',
        editorSourceCapabilities: {
          source: 'code',
          storage: 'filesystem',
          canSave: true,
          canOpenChangeRequest: false,
        },
      });
    });

    it('should return unavailable capabilities for hosted code-source editor storage without a provider', async () => {
      process.env.MASTRA_CLOUD_API_ENDPOINT = 'https://example.mastra.cloud';

      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra({ getSource: () => 'code' }),
      } as any);

      expect(result).toMatchObject({
        cmsEnabled: true,
        editorSource: 'code',
        editorSourceCapabilities: {
          source: 'code',
          storage: 'unavailable',
          canSave: false,
          canOpenChangeRequest: false,
          unavailableReason: 'Code-source editing requires a source provider in hosted Studio.',
        },
      });
    });

    it('should return configured source-provider capabilities for code-source editor storage', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra({
          getSource: () => 'code',
          getSourceControlProvider: () => ({
            id: 'mock-source',
            displayName: 'Mock Source',
            getCapabilities: async () => ({ canWrite: true, canOpenChangeRequest: true }),
          }),
        }),
      } as any);

      expect(result).toMatchObject({
        cmsEnabled: true,
        editorSource: 'code',
        editorSourceCapabilities: {
          source: 'code',
          storage: 'source-provider',
          provider: { id: 'mock-source', displayName: 'Mock Source' },
          canSave: true,
          canOpenChangeRequest: true,
        },
      });
    });

    it('should return unavailable capabilities when source-provider probing fails', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra({
          getSource: () => 'code',
          getSourceControlProvider: () => ({
            id: 'mock-source',
            displayName: 'Mock Source',
            getCapabilities: async () => {
              throw new Error('provider unavailable');
            },
          }),
        }),
      } as any);

      expect(result).toMatchObject({
        editorSourceCapabilities: {
          source: 'code',
          storage: 'source-provider',
          provider: { id: 'mock-source', displayName: 'Mock Source' },
          canSave: false,
          canOpenChangeRequest: false,
          unavailableReason: 'Unable to load source provider capabilities.',
        },
      });
    });

    it('should time out stalled source-provider capability probes', async () => {
      vi.useFakeTimers();

      const resultPromise = GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra({
          getSource: () => 'code',
          getSourceControlProvider: () => ({
            id: 'mock-source',
            displayName: 'Mock Source',
            getCapabilities: () => new Promise<never>(() => {}),
          }),
        }),
      } as any);

      await vi.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      expect(result).toMatchObject({
        editorSourceCapabilities: {
          source: 'code',
          storage: 'source-provider',
          provider: { id: 'mock-source', displayName: 'Mock Source' },
          canSave: false,
          canOpenChangeRequest: false,
          unavailableReason: 'Unable to load source provider capabilities.',
        },
      });
    });

    it('should return provider unavailable reasons for read-only source-provider storage', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra({
          getSource: () => 'code',
          getSourceControlProvider: () => ({
            id: 'mock-source',
            displayName: 'Mock Source',
            getCapabilities: async () => ({
              canWrite: false,
              canOpenChangeRequest: false,
              reason: 'Missing source provider write permission.',
            }),
          }),
        }),
      } as any);

      expect(result).toMatchObject({
        editorSourceCapabilities: {
          source: 'code',
          storage: 'source-provider',
          canSave: false,
          canOpenChangeRequest: false,
          unavailableReason: 'Missing source provider write permission.',
        },
      });
    });

    it('should return database capabilities for db-source editor storage', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra({ getSource: () => 'db' }),
      } as any);

      expect(result).toMatchObject({
        cmsEnabled: true,
        editorSource: 'db',
        editorSourceCapabilities: {
          source: 'db',
          storage: 'database',
          canSave: true,
          canOpenChangeRequest: false,
        },
      });
    });

    it('should return observabilityEnabled true when observability is configured', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra(false, undefined, true),
      } as any);

      expect(result).toEqual({
        packages: [],
        isDev: false,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: true,
        storageType: undefined,
        observabilityStorageType: undefined,
        observabilityRuntimeStrategy: undefined,
      });
    });

    it('should return runtime tracing strategy from the attached observability store', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra(false, {
          name: 'mock-storage',
          stores: {
            observability: {
              constructor: { name: 'MockObservabilityStore' },
              runtimeTracingStrategy: 'realtime',
            },
          },
        }),
      } as any);

      expect(result).toEqual({
        packages: [],
        isDev: false,
        cmsEnabled: false,
        liveKitConnectionRouteEnabled: false,
        observabilityEnabled: false,
        storageType: 'mock-storage',
        observabilityStorageType: 'MockObservabilityStore',
        observabilityStorageCapabilities: NO_OBSERVABILITY_CAPABILITIES,
        observabilityRuntimeStrategy: 'realtime',
      });
    });

    it('should return stable observability capabilities when the storage class name changes during bundling', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra(false, {
          name: 'PostgresStoreVNext',
          stores: {
            observability: {
              constructor: { name: '_ObservabilityStoragePostgresVNext' },
              runtimeTracingStrategy: 'insert-only',
              getFeatures: () => ['metrics', 'logs', 'trace-query', 'trace-query-discovery'],
            },
          },
        }),
      } as any);

      expect(result).toMatchObject({
        observabilityStorageType: '_ObservabilityStoragePostgresVNext',
        observabilityStorageCapabilities: {
          metrics: true,
          logs: true,
          traceQueryDiscovery: true,
        },
      });
    });

    it('should not infer discovery support from trace-query support', async () => {
      const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
        mastra: createMockMastra(false, {
          name: 'mock-storage',
          stores: {
            observability: {
              constructor: { name: 'MockObservabilityStore' },
              getFeatures: () => ['metrics', 'logs', 'trace-query'],
            },
          },
        }),
      } as any);

      expect(result).toMatchObject({
        observabilityStorageCapabilities: {
          metrics: true,
          logs: true,
          traceQueryDiscovery: false,
        },
      });
    });

    describe('observability storage capabilities', () => {
      // Mirrors ObservabilityStorage: optional methods throw until a store overrides them.
      class BaseObservabilityStore {
        async getEntityNames(): Promise<unknown> {
          throw new Error('not implemented');
        }
        async getMetricAggregate(): Promise<unknown> {
          throw new Error('not implemented');
        }
        async getMetricBreakdown(): Promise<unknown> {
          throw new Error('not implemented');
        }
        async getMetricTimeSeries(): Promise<unknown> {
          throw new Error('not implemented');
        }
        async getMetricPercentiles(): Promise<unknown> {
          throw new Error('not implemented');
        }
        async listLogs(): Promise<unknown> {
          throw new Error('not implemented');
        }
        async getTrace(): Promise<unknown> {
          throw new Error('not implemented');
        }
      }

      const capabilitiesFor = async (observability: object) => {
        const result = await GET_SYSTEM_PACKAGES_ROUTE.handler({
          mastra: createMockMastra(false, { name: 'mock-storage', stores: { observability } } as MockStorage),
        } as any);
        return (result as { observabilityStorageCapabilities?: unknown }).observabilityStorageCapabilities;
      };

      it('reports every optional API as unsupported for a legacy store without upgrading it', async () => {
        class LegacyStore extends BaseObservabilityStore {
          override async getTrace() {
            return null;
          }
        }

        expect(await capabilitiesFor(new LegacyStore())).toEqual(NO_OBSERVABILITY_CAPABILITIES);
      });

      it('detects discovery, metrics and logs on stores that implement them without declaring features', async () => {
        class UndeclaredAnalyticsStore extends BaseObservabilityStore {
          override async getEntityNames() {
            return { names: [] };
          }
          override async getMetricAggregate() {
            return {};
          }
          override async getMetricBreakdown() {
            return {};
          }
          override async getMetricTimeSeries() {
            return {};
          }
          override async getMetricPercentiles() {
            return {};
          }
          override async listLogs() {
            return {};
          }
        }

        expect(await capabilitiesFor(new UndeclaredAnalyticsStore())).toEqual({
          ...NO_OBSERVABILITY_CAPABILITIES,
          metrics: true,
          logs: true,
          discovery: { ...NO_OBSERVABILITY_CAPABILITIES.discovery, entityNames: true },
        });
      });

      it('requires every method behind a feature on undeclared stores', async () => {
        class PartialMetricsStore extends BaseObservabilityStore {
          override async getMetricAggregate() {
            return {};
          }
        }

        expect(await capabilitiesFor(new PartialMetricsStore())).toEqual(NO_OBSERVABILITY_CAPABILITIES);
      });

      it('detects overrides through intermediate subclasses', async () => {
        class AnalyticsStore extends BaseObservabilityStore {
          override async getEntityNames() {
            return { names: [] };
          }
        }
        class ExtendedAnalyticsStore extends AnalyticsStore {}

        expect(await capabilitiesFor(new ExtendedAnalyticsStore())).toMatchObject({ discovery: { entityNames: true } });
      });

      it('uses declared features when the store provides them', async () => {
        class DeclaredStore extends BaseObservabilityStore {
          getFeatures() {
            return [
              'tag-discovery',
              'metric-discovery',
              'delta-polling',
              'thread-query',
              'trace-query-root-duration',
              'trace-query-tenant-scope',
            ] as const;
          }
        }

        expect(await capabilitiesFor(new DeclaredStore())).toEqual({
          ...NO_OBSERVABILITY_CAPABILITIES,
          discovery: { ...NO_OBSERVABILITY_CAPABILITIES.discovery, tags: true, metrics: true },
          deltaPolling: true,
          traceQueryRootDuration: true,
          traceQueryTenantScope: true,
          threadQuery: true,
        });
      });

      it('treats a declared feature list as final even when methods are overridden', async () => {
        // e.g. Spanner with metrics disabled: the methods exist but throw.
        class OptOutStore extends BaseObservabilityStore {
          getFeatures() {
            return [] as const;
          }
          override async getMetricAggregate() {
            throw new Error('metrics are disabled');
          }
          override async getEntityNames() {
            throw new Error('disabled');
          }
        }

        expect(await capabilitiesFor(new OptOutStore())).toEqual(NO_OBSERVABILITY_CAPABILITIES);
      });

      it('treats trace-query as implying discovery for stores released before per-endpoint discovery features', async () => {
        class TraceQueryStore extends BaseObservabilityStore {
          getFeatures() {
            return ['metrics', 'logs', 'trace-query'] as const;
          }
        }

        expect(await capabilitiesFor(new TraceQueryStore())).toEqual({
          ...NO_OBSERVABILITY_CAPABILITIES,
          metrics: true,
          logs: true,
          discovery: {
            entityTypes: true,
            entityNames: true,
            serviceNames: true,
            environments: true,
            tags: true,
            metrics: true,
          },
          traceQuery: true,
        });
      });

      it('does not report query refinements for stores without trace or thread queries', async () => {
        class RefinementsOnlyStore extends BaseObservabilityStore {
          getFeatures() {
            return ['trace-query-root-duration', 'trace-query-tenant-scope'] as const;
          }
        }

        expect(await capabilitiesFor(new RefinementsOnlyStore())).toEqual(NO_OBSERVABILITY_CAPABILITIES);
      });
    });
  });
});
