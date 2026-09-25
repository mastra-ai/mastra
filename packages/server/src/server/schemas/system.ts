import { z } from 'zod/v4';

export const mastraPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const observabilityRuntimeStrategySchema = z.enum([
  'realtime',
  'batch-with-updates',
  'insert-only',
  'event-sourced',
]);

export const observabilityDiscoveryCapabilitiesSchema = z.object({
  entityTypes: z.boolean().describe('GET /observability/discovery/entity-types'),
  entityNames: z.boolean().describe('GET /observability/discovery/entity-names'),
  serviceNames: z.boolean().describe('GET /observability/discovery/service-names'),
  environments: z.boolean().describe('GET /observability/discovery/environments'),
  tags: z.boolean().describe('GET /observability/discovery/tags'),
  metrics: z.boolean().describe('GET /observability/discovery/metric-names, metric-label-keys and metric-label-values'),
});

/**
 * Optional observability APIs the configured observability store can serve.
 * Omitted when no observability store is configured.
 */
export const observabilityStorageCapabilitiesSchema = z.object({
  metrics: z.boolean().describe('Metrics endpoints (/observability/metrics and /observability/metrics/*)'),
  logs: z.boolean().describe('Logs endpoint (GET /observability/logs)'),
  discovery: observabilityDiscoveryCapabilitiesSchema.describe(
    'Filter discovery endpoints. Unsupported discovery routes return empty results.',
  ),
  deltaPolling: z.boolean().describe("Cursor-based `mode: 'delta'` polling on observability list endpoints"),
  traceQuery: z
    .boolean()
    .describe(
      'Advanced trace queries (POST /observability/traces/query). When false, list traces with GET /observability/traces/light instead.',
    ),
  traceQueryRootDuration: z.boolean().describe('`durationMs` predicates in trace and thread queries'),
  traceQueryDiscovery: z
    .boolean()
    .describe('Trace query field discovery (POST /observability/traces/query/fields and /values)'),
  traceQueryTenantScope: z.boolean().describe('Trusted tenant scoping of trace and thread queries'),
  threadQuery: z.boolean().describe('Advanced thread queries (POST /observability/threads/query)'),
  feedback: z
    .boolean()
    .describe(
      'Feedback endpoints (/observability/feedback and /observability/feedback/*). Unsupported feedback routes return 501.',
    ),
});

export const editorSourceSchema = z.enum(['code', 'db']);

export const editorSourceCapabilitiesSchema = z.object({
  source: editorSourceSchema,
  storage: z.enum(['database', 'filesystem', 'source-provider', 'unavailable']),
  provider: z
    .object({
      id: z.string(),
      displayName: z.string(),
    })
    .optional(),
  canSave: z.boolean(),
  canOpenChangeRequest: z.boolean(),
  unavailableReason: z.string().optional(),
});

export const systemPackagesResponseSchema = z.object({
  packages: z.array(mastraPackageSchema),
  isDev: z.boolean(),
  cmsEnabled: z.boolean(),
  /** Whether the default LiveKit connection-details route is registered — not whether credentials or a worker exist. */
  liveKitConnectionRouteEnabled: z.boolean(),
  /**
   * The editor's configured source, when set. `'code'` swaps Studio's
   * Save/Publish UI for Download JSON + Open PR. `'db'` keeps the standard
   * Save/Publish flow. Omitted when the editor has no explicit source.
   */
  editorSource: editorSourceSchema.optional(),
  editorSourceCapabilities: editorSourceCapabilitiesSchema.optional(),
  observabilityEnabled: z.boolean(),
  storageType: z.string().optional(),
  observabilityStorageType: z.string().optional(),
  observabilityStorageCapabilities: observabilityStorageCapabilitiesSchema.optional(),
  observabilityRuntimeStrategy: observabilityRuntimeStrategySchema.optional(),
});

const jsonSchemaRecordSchema = z.record(z.string(), z.unknown());

export const apiSchemaResponseShapeSchema = z.object({
  kind: z.enum(['array', 'record', 'object-property', 'single', 'unknown']),
  listProperty: z.string().optional(),
  paginationProperty: z.string().optional(),
});

export const apiSchemaManifestRouteSchema = z.object({
  method: z.string(),
  path: z.string(),
  responseType: z.string(),
  pathParamSchema: jsonSchemaRecordSchema.optional(),
  queryParamSchema: jsonSchemaRecordSchema.optional(),
  bodySchema: jsonSchemaRecordSchema.optional(),
  responseSchema: jsonSchemaRecordSchema.optional(),
  responseShape: apiSchemaResponseShapeSchema,
});

export const apiSchemaManifestResponseSchema = z.object({
  version: z.literal(1),
  routes: z.array(apiSchemaManifestRouteSchema),
});

export type MastraPackage = z.infer<typeof mastraPackageSchema>;
export type SystemPackagesResponse = z.infer<typeof systemPackagesResponseSchema>;
